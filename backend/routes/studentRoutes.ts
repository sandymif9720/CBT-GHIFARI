import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../database/db.ts';
import { type AuthenticatedRequest, getClientIp, logActivity, requireAuth, requireRole } from '../utils/auth.ts';
import { recalculateParticipantResult } from './examRoutes.ts';

const router = Router();

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${cleanTime}`);
}

function formatSqlLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getStudentRecord(userId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT s.*, c.name AS class_name, d.name AS department_name
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN departments d ON d.id = s.department_id
    WHERE s.user_id = ?
  `).get(userId) as any;
}

// Student Exam List & Allowed Results
router.get('/exams', requireAuth, requireRole('siswa'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const student = getStudentRecord(req.user!.userId);
  if (!student) {
    res.status(404).json({ error: 'Profil siswa tidak ditemukan.' });
    return;
  }

  const exams = db.prepare(`
    SELECT e.id, e.title, e.exam_date, e.start_time, e.end_time, e.duration_minutes,
           e.question_count, e.passing_grade, e.show_result, e.status AS exam_status, e.instructions,
           s.name AS subject_name, s.code AS subject_code,
           c.name AS class_name,
           u.full_name AS teacher_name,
           ep.id AS participant_id, ep.status AS participant_status, ep.started_at, ep.expires_at, ep.submitted_at,
           er.pg_correct, er.pg_total, er.pg_score, er.essay_score, er.essay_graded, er.final_score, er.passed
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    JOIN classes c ON c.id = e.class_id
    JOIN users u ON u.id = e.created_by
    LEFT JOIN exam_participants ep ON ep.exam_id = e.id AND ep.student_id = ?
    LEFT JOIN exam_results er ON er.participant_id = ep.id
    WHERE e.class_id = ? AND e.status != 'Draft' AND e.status != 'Dibatalkan'
    ORDER BY e.exam_date DESC, e.start_time ASC
  `).all(student.id, student.class_id) as any[];

  const now = new Date();

  const mapped = exams.map((e) => {
    const startDt = parseLocalDateTime(e.exam_date, e.start_time);
    const endDt = parseLocalDateTime(e.exam_date, e.end_time);
    const withinWindow = now >= startDt && now <= endDt;

    let canStart = false;
    let scheduleNote = '';

    if (e.participant_status === 'selesai' || e.participant_status === 'waktu_habis') {
      scheduleNote = 'Sudah diselesaikan';
    } else if (e.participant_status === 'sedang_mengerjakan' || e.participant_status === 'terputus') {
      const expDt = e.expires_at ? new Date(e.expires_at.replace(' ', 'T')) : endDt;
      if (now <= expDt) {
        canStart = true;
        scheduleNote = 'Sesi sedang berjalan — lanjutkan ujian';
      } else {
        scheduleNote = 'Waktu pengerjaan telah berakhir';
      }
    } else if (e.exam_status === 'Selesai') {
      scheduleNote = 'Ujian telah ditutup';
    } else if (!withinWindow) {
      scheduleNote = now < startDt
        ? `Belum dimulai (Jadwal: ${e.exam_date} ${e.start_time})`
        : `Jadwal telah berakhir (${e.exam_date} ${e.end_time})`;
    } else if (e.exam_status === 'Berlangsung' || e.exam_status === 'Terjadwal') {
      canStart = true;
      scheduleNote = 'Tersedia untuk dikerjakan';
    }

    // Never expose results if show_result is 0
    const visibleResult = e.show_result === 1 && (e.participant_status === 'selesai' || e.participant_status === 'waktu_habis')
      ? {
          pgCorrect: e.pg_correct,
          pgTotal: e.pg_total,
          pgScore: e.pg_score,
          essayScore: e.essay_score,
          essayGraded: Boolean(e.essay_graded),
          finalScore: e.final_score,
          passed: e.passed === null ? null : Boolean(e.passed),
        }
      : null;

    return {
      id: e.id,
      title: e.title,
      subjectName: e.subject_name,
      subjectCode: e.subject_code,
      className: e.class_name,
      teacherName: e.teacher_name,
      examDate: e.exam_date,
      startTime: e.start_time,
      endTime: e.end_time,
      durationMinutes: e.duration_minutes,
      questionCount: e.question_count,
      passingGrade: e.passing_grade,
      showResult: Boolean(e.show_result),
      examStatus: e.exam_status,
      instructions: e.instructions,
      participantStatus: e.participant_status || 'belum_mulai',
      canStart,
      scheduleNote,
      result: visibleResult,
    };
  });

  res.json({ student, exams: mapped, serverTime: now.toISOString() });
});

// Start or Resume Exam
router.post('/exams/:id/start', requireAuth, requireRole('siswa'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const student = getStudentRecord(req.user!.userId);
  if (!student) {
    res.status(404).json({ error: 'Profil siswa tidak ditemukan.' });
    return;
  }

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id) as any;
  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }
  if (exam.class_id !== student.class_id) {
    res.status(403).json({ error: 'Ujian ini bukan untuk kelas Anda.' });
    return;
  }
  if (exam.status === 'Draft' || exam.status === 'Dibatalkan' || exam.status === 'Selesai') {
    res.status(400).json({ error: `Ujian berstatus "${exam.status}" dan tidak dapat dimulai.` });
    return;
  }

  const now = new Date();
  const startDt = parseLocalDateTime(exam.exam_date, exam.start_time);
  const endDt = parseLocalDateTime(exam.exam_date, exam.end_time);

  // Check existing participation for this exam
  const existing = db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').get(
    exam.id,
    student.id
  ) as any;

  if (existing) {
    if (existing.status === 'selesai' || existing.status === 'waktu_habis') {
      res.status(400).json({ error: 'Anda sudah menyelesaikan ujian ini dan tidak dapat mengikutinya dua kali.' });
      return;
    }

    const expDt = new Date(existing.expires_at.replace(' ', 'T'));
    if (now >= expDt) {
      db.transaction(() => {
        db.prepare(`UPDATE exam_participants SET status = 'waktu_habis', submitted_at = datetime('now', 'localtime') WHERE id = ?`).run(
          existing.id
        );
        recalculateParticipantResult(existing.id);
      })();
      res.status(400).json({ error: 'Waktu pengerjaan ujian Anda sudah habis.' });
      return;
    }

    // Resume existing session
    const sessionToken = crypto.randomBytes(24).toString('hex');
    db.prepare(`
      UPDATE exam_participants
      SET status = 'sedang_mengerjakan', session_token = ?, last_seen_at = datetime('now', 'localtime'), ip_address = ?
      WHERE id = ?
    `).run(sessionToken, getClientIp(req), existing.id);

    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: 'siswa',
      action: 'RESUME_EXAM',
      entityType: 'exam',
      entityId: exam.id,
      details: `${req.user!.fullName} melanjutkan sesi ujian "${exam.title}".`,
      ipAddress: getClientIp(req),
    });

    res.json({ participantId: existing.id, sessionToken, resumed: true });
    return;
  }

  // Schedule validation for new start
  if (now < startDt || now > endDt) {
    res.status(400).json({
      error: `Ujian hanya dapat dimulai sesuai jadwal (${exam.exam_date} pukul ${exam.start_time} – ${exam.end_time}).`,
    });
    return;
  }

  // Enforce 1 active exam session per student
  const otherActive = db.prepare(`
    SELECT ep.id, e.title FROM exam_participants ep
    JOIN exams e ON e.id = ep.exam_id
    WHERE ep.student_id = ? AND ep.exam_id != ? AND ep.status IN ('sedang_mengerjakan', 'terputus')
  `).get(student.id, exam.id) as { id: number; title: string } | undefined;

  if (otherActive) {
    res.status(400).json({
      error: `Anda masih memiliki sesi ujian aktif pada "${otherActive.title}". Selesaikan ujian tersebut terlebih dahulu.`,
    });
    return;
  }

  const assignedQs = db.prepare(`
    SELECT q.id, q.question_type
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.order_index ASC
  `).all(exam.id) as Array<{ id: number; question_type: string }>;

  if (assignedQs.length === 0) {
    res.status(400).json({ error: 'Ujian ini belum memiliki butir soal. Hubungi guru pengampu.' });
    return;
  }

  const qOrder = exam.shuffle_questions ? shuffleArray(assignedQs.map((q) => q.id)) : assignedQs.map((q) => q.id);
  const optionOrders: Record<string, string[]> = {};
  for (const q of assignedQs) {
    if (q.question_type === 'PG') {
      optionOrders[String(q.id)] = exam.shuffle_options
        ? shuffleArray(['A', 'B', 'C', 'D', 'E'])
        : ['A', 'B', 'C', 'D', 'E'];
    }
  }

  const durationEnd = new Date(now.getTime() + exam.duration_minutes * 60 * 1000);
  const effectiveExpires = durationEnd < endDt ? durationEnd : endDt;
  const sessionToken = crypto.randomBytes(24).toString('hex');

  const insRes = db.prepare(`
    INSERT INTO exam_participants (
      exam_id, student_id, status, session_token, question_order_json, option_orders_json,
      started_at, expires_at, last_seen_at, ip_address
    ) VALUES (?, ?, 'sedang_mengerjakan', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    exam.id,
    student.id,
    sessionToken,
    JSON.stringify(qOrder),
    JSON.stringify(optionOrders),
    formatSqlLocalDateTime(now),
    formatSqlLocalDateTime(effectiveExpires),
    formatSqlLocalDateTime(now),
    getClientIp(req)
  );

  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: 'siswa',
    action: 'START_EXAM',
    entityType: 'exam',
    entityId: exam.id,
    details: `${req.user!.fullName} memulai ujian "${exam.title}".`,
    ipAddress: getClientIp(req),
  });

  res.json({ participantId: insRes.lastInsertRowid, sessionToken, resumed: false });
});

// Get Exam Session Questions & Saved Answers (NEVER sends correct_answer!)
router.get('/exams/:id/session', requireAuth, requireRole('siswa'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const student = getStudentRecord(req.user!.userId);
  if (!student) {
    res.status(404).json({ error: 'Profil siswa tidak ditemukan.' });
    return;
  }

  const exam = db.prepare(`
    SELECT e.id, e.title, e.duration_minutes, e.passing_grade, e.show_result, e.instructions,
           s.name AS subject_name, c.name AS class_name
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    JOIN classes c ON c.id = e.class_id
    WHERE e.id = ?
  `).get(req.params.id) as any;

  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }

  const participant = db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').get(
    exam.id,
    student.id
  ) as any;

  if (!participant) {
    res.status(400).json({ error: 'Anda belum memulai sesi ujian ini.' });
    return;
  }

  if (participant.status === 'selesai' || participant.status === 'waktu_habis') {
    res.json({ finished: true, status: participant.status });
    return;
  }

  const nowMs = Date.now();
  const expMs = new Date(participant.expires_at.replace(' ', 'T')).getTime();
  const remainingSeconds = Math.max(0, Math.floor((expMs - nowMs) / 1000));

  if (remainingSeconds <= 0) {
    db.transaction(() => {
      db.prepare(`UPDATE exam_participants SET status = 'waktu_habis', submitted_at = datetime('now', 'localtime') WHERE id = ?`).run(
        participant.id
      );
      recalculateParticipantResult(participant.id);
    })();
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: 'siswa',
      action: 'EXAM_TIMEOUT',
      entityType: 'exam',
      entityId: exam.id,
      details: `Waktu ujian "${exam.title}" habis untuk ${req.user!.fullName}.`,
      ipAddress: getClientIp(req),
    });
    res.json({ finished: true, expired: true, status: 'waktu_habis' });
    return;
  }

  db.prepare(`UPDATE exam_participants SET last_seen_at = datetime('now', 'localtime'), status = 'sedang_mengerjakan' WHERE id = ?`).run(
    participant.id
  );

  const qOrder: number[] = JSON.parse(participant.question_order_json || '[]');
  const optionOrders: Record<string, string[]> = JSON.parse(participant.option_orders_json || '{}');

  // Explicitly omit correct_answer!
  const rawQuestions = db.prepare(`
    SELECT id, question_code, topic, question_type, question_text, image_url,
           option_a, option_b, option_c, option_d, option_e, score
    FROM questions
    WHERE id IN (${qOrder.map(() => '?').join(',') || '0'})
  `).all(...qOrder) as any[];

  const qMap = new Map(rawQuestions.map((q) => [q.id, q]));
  const labels = ['A', 'B', 'C', 'D', 'E'];

  const orderedQuestions = qOrder
    .map((qid, idx) => {
      const q = qMap.get(qid);
      if (!q) return null;

      let options: Array<{ displayLabel: string; optionKey: string; text: string }> = [];
      if (q.question_type === 'PG') {
        const order = optionOrders[String(q.id)] || ['A', 'B', 'C', 'D', 'E'];
        const textMap: Record<string, string> = {
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d,
          E: q.option_e,
        };
        options = order.map((canonicalKey, optIdx) => ({
          displayLabel: labels[optIdx],
          optionKey: canonicalKey,
          text: textMap[canonicalKey] || '',
        }));
      }

      return {
        number: idx + 1,
        id: q.id,
        questionCode: q.question_code,
        topic: q.topic,
        questionType: q.question_type,
        questionText: q.question_text,
        imageUrl: q.image_url,
        score: q.score,
        options,
      };
    })
    .filter(Boolean);

  const savedAnswers = db.prepare(`
    SELECT question_id, answer_text, is_doubtful, answered_at
    FROM answers
    WHERE participant_id = ?
  `).all(participant.id) as any[];

  const answersMap: Record<number, { answerText: string; isDoubtful: boolean; answeredAt: string }> = {};
  for (const a of savedAnswers) {
    answersMap[a.question_id] = {
      answerText: a.answer_text,
      isDoubtful: Boolean(a.is_doubtful),
      answeredAt: a.answered_at,
    };
  }

  res.json({
    finished: false,
    exam,
    student: {
      fullName: req.user!.fullName,
      nis: student.nis,
      participantNumber: student.participant_number,
      className: student.class_name,
    },
    participantId: participant.id,
    startedAt: participant.started_at,
    expiresAt: participant.expires_at,
    remainingSeconds,
    questions: orderedQuestions,
    answers: answersMap,
    serverTime: new Date().toISOString(),
  });
});

// Auto-save Answer (inside transaction)
router.post('/exams/:id/answer', requireAuth, requireRole('siswa'), (req: AuthenticatedRequest, res) => {
  const { question_id, answer_text, is_doubtful } = req.body || {};
  if (!question_id) {
    res.status(400).json({ error: 'ID soal wajib dikirim.' });
    return;
  }

  const db = getDb();
  const student = getStudentRecord(req.user!.userId);
  if (!student) {
    res.status(404).json({ error: 'Profil siswa tidak ditemukan.' });
    return;
  }

  const participant = db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').get(
    req.params.id,
    student.id
  ) as any;

  if (!participant) {
    res.status(400).json({ error: 'Sesi ujian tidak ditemukan.' });
    return;
  }
  if (participant.status === 'selesai' || participant.status === 'waktu_habis') {
    res.status(400).json({ error: 'Ujian sudah berakhir.' });
    return;
  }

  const nowMs = Date.now();
  const expMs = new Date(participant.expires_at.replace(' ', 'T')).getTime();
  if (nowMs > expMs + 5000) {
    db.transaction(() => {
      db.prepare(`UPDATE exam_participants SET status = 'waktu_habis', submitted_at = datetime('now', 'localtime') WHERE id = ?`).run(
        participant.id
      );
      recalculateParticipantResult(participant.id);
    })();
    res.status(400).json({ error: 'Waktu ujian telah habis.', expired: true });
    return;
  }

  const qOrder: number[] = JSON.parse(participant.question_order_json || '[]');
  if (!qOrder.includes(Number(question_id))) {
    res.status(400).json({ error: 'Soal tidak terdaftar dalam sesi ujian Anda.' });
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO answers (participant_id, question_id, answer_text, is_doubtful, answered_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      ON CONFLICT(participant_id, question_id) DO UPDATE SET
        answer_text = excluded.answer_text,
        is_doubtful = excluded.is_doubtful,
        answered_at = datetime('now', 'localtime')
    `).run(participant.id, Number(question_id), String(answer_text ?? ''), is_doubtful ? 1 : 0);

    db.prepare(`
      UPDATE exam_participants SET last_seen_at = datetime('now', 'localtime'), status = 'sedang_mengerjakan', ip_address = ?
      WHERE id = ?
    `).run(getClientIp(req), participant.id);
  });

  tx();

  res.json({
    saved: true,
    savedAt: new Date().toISOString(),
    remainingSeconds: Math.max(0, Math.floor((expMs - Date.now()) / 1000)),
  });
});

// Heartbeat & Server Time Sync
router.post('/exams/:id/heartbeat', requireAuth, requireRole('siswa'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const student = getStudentRecord(req.user!.userId);
  if (!student) {
    res.status(404).json({ error: 'Profil siswa tidak ditemukan.' });
    return;
  }

  const participant = db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').get(
    req.params.id,
    student.id
  ) as any;

  if (!participant) {
    res.status(404).json({ error: 'Sesi tidak ditemukan.' });
    return;
  }
  if (participant.status === 'selesai' || participant.status === 'waktu_habis') {
    res.json({ finished: true, remainingSeconds: 0 });
    return;
  }

  const expMs = new Date(participant.expires_at.replace(' ', 'T')).getTime();
  const remainingSeconds = Math.max(0, Math.floor((expMs - Date.now()) / 1000));

  if (remainingSeconds <= 0) {
    db.transaction(() => {
      db.prepare(`UPDATE exam_participants SET status = 'waktu_habis', submitted_at = datetime('now', 'localtime') WHERE id = ?`).run(
        participant.id
      );
      recalculateParticipantResult(participant.id);
    })();
    res.json({ finished: true, expired: true, remainingSeconds: 0 });
    return;
  }

  db.prepare(`UPDATE exam_participants SET last_seen_at = datetime('now', 'localtime'), status = 'sedang_mengerjakan' WHERE id = ?`).run(
    participant.id
  );

  res.json({ finished: false, remainingSeconds, serverTime: new Date().toISOString() });
});

// Finish Exam (Transaction + Auto-grade PG + Create Essay grading tasks)
router.post('/exams/:id/finish', requireAuth, requireRole('siswa'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const student = getStudentRecord(req.user!.userId);
  if (!student) {
    res.status(404).json({ error: 'Profil siswa tidak ditemukan.' });
    return;
  }

  const participant = db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').get(
    req.params.id,
    student.id
  ) as any;

  if (!participant) {
    res.status(400).json({ error: 'Sesi ujian tidak ditemukan.' });
    return;
  }

  if (participant.status === 'selesai' || participant.status === 'waktu_habis') {
    res.json({ message: 'Ujian telah diselesaikan sebelumnya.' });
    return;
  }

  const isTimeout = Boolean(req.body?.timeout);
  const newStatus = isTimeout ? 'waktu_habis' : 'selesai';

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE exam_participants
      SET status = ?, submitted_at = datetime('now', 'localtime'), last_seen_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newStatus, participant.id);

    recalculateParticipantResult(participant.id);
  });

  tx();

  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: 'siswa',
    action: isTimeout ? 'EXAM_AUTO_SUBMIT' : 'FINISH_EXAM',
    entityType: 'exam',
    entityId: req.params.id,
    details: `${req.user!.fullName} menyelesaikan ujian ID ${req.params.id} (${newStatus}).`,
    ipAddress: getClientIp(req),
  });

  const exam = db.prepare('SELECT show_result FROM exams WHERE id = ?').get(req.params.id) as { show_result: number } | undefined;
  const result = exam?.show_result === 1
    ? db.prepare('SELECT pg_correct, pg_total, pg_score, essay_score, essay_graded, final_score, passed FROM exam_results WHERE participant_id = ?').get(participant.id)
    : null;

  res.json({
    message: isTimeout ? 'Waktu ujian habis. Jawaban Anda telah disimpan otomatis.' : 'Ujian berhasil dikumpulkan.',
    showResult: exam?.show_result === 1,
    result,
  });
});

export default router;
