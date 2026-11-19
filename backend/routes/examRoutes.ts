import { Router } from 'express';
import ExcelJS from 'exceljs';
import { getDb } from '../database/db.ts';
import { type AuthenticatedRequest, getClientIp, logActivity, requireAuth, requireRole } from '../utils/auth.ts';

const router = Router();

// Helper to recalculate participant exam_results whenever essay grades or exam weights update
export function recalculateParticipantResult(participantId: number): void {
  const db = getDb();
  const participant = db.prepare(`
    SELECT ep.id, ep.exam_id, ep.student_id, e.pg_weight, e.essay_weight, e.passing_grade
    FROM exam_participants ep
    JOIN exams e ON e.id = ep.exam_id
    WHERE ep.id = ?
  `).get(participantId) as {
    id: number;
    exam_id: number;
    student_id: number;
    pg_weight: number;
    essay_weight: number;
    passing_grade: number;
  } | undefined;

  if (!participant) return;

  const examQs = db.prepare(`
    SELECT q.id, q.question_type, q.correct_answer, q.score
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
  `).all(participant.exam_id) as Array<{
    id: number;
    question_type: 'PG' | 'ESAI';
    correct_answer: string;
    score: number;
  }>;

  const answers = db.prepare(`
    SELECT id, question_id, answer_text
    FROM answers
    WHERE participant_id = ?
  `).all(participantId) as Array<{ id: number; question_id: number; answer_text: string }>;

  const ansMap = new Map(answers.map((a) => [a.question_id, a]));

  let pgTotal = 0;
  let pgCorrect = 0;
  let pgMaxScore = 0;
  let pgEarnedScore = 0;

  let essayCount = 0;
  let essayMaxScore = 0;
  let essayEarnedScore = 0;
  let allEssaysGraded = true;

  for (const q of examQs) {
    const ans = ansMap.get(q.id);
    if (q.question_type === 'PG') {
      pgTotal++;
      pgMaxScore += q.score;
      const isCorrect = ans && ans.answer_text.trim().toUpperCase() === q.correct_answer.trim().toUpperCase() ? 1 : 0;
      if (isCorrect) {
        pgCorrect++;
        pgEarnedScore += q.score;
      }
      if (ans) {
        db.prepare('UPDATE answers SET is_correct = ?, earned_score = ? WHERE id = ?').run(
          isCorrect,
          isCorrect ? q.score : 0,
          ans.id
        );
      }
    } else {
      essayCount++;
      essayMaxScore += q.score;
      if (ans) {
        const grade = db.prepare('SELECT id, score, status FROM essay_grades WHERE answer_id = ?').get(ans.id) as
          | { id: number; score: number; status: string }
          | undefined;
        if (!grade) {
          db.prepare(`
            INSERT INTO essay_grades (answer_id, participant_id, question_id, score, max_score, feedback, status)
            VALUES (?, ?, ?, 0, ?, '', 'belum_dinilai')
          `).run(ans.id, participantId, q.id, q.score);
          allEssaysGraded = false;
        } else if (grade.status !== 'sudah_dinilai') {
          allEssaysGraded = false;
        } else {
          essayEarnedScore += grade.score;
        }
      } else {
        // Student didn't answer this essay question; create blank answer + pending essay grade so teacher can verify
        const insAns = db.prepare(`
          INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score)
          VALUES (?, ?, '', NULL, 0)
        `).run(participantId, q.id);
        db.prepare(`
          INSERT INTO essay_grades (answer_id, participant_id, question_id, score, max_score, feedback, status)
          VALUES (?, ?, ?, 0, ?, '', 'belum_dinilai')
        `).run(insAns.lastInsertRowid, participantId, q.id, q.score);
        allEssaysGraded = false;
      }
    }
  }

  const pgPercent = pgMaxScore > 0 ? (pgEarnedScore / pgMaxScore) * 100 : 0;
  const essayPercent = essayMaxScore > 0 ? (essayEarnedScore / essayMaxScore) * 100 : 0;

  let finalScore: number | null = null;
  let passed: number | null = null;

  if (essayCount === 0) {
    finalScore = Number(pgPercent.toFixed(2));
    passed = finalScore >= participant.passing_grade ? 1 : 0;
  } else if (allEssaysGraded) {
    if (pgTotal === 0) {
      finalScore = Number(essayPercent.toFixed(2));
    } else {
      const totalWeight = participant.pg_weight + participant.essay_weight;
      const wPg = totalWeight > 0 ? participant.pg_weight / totalWeight : 0.7;
      const wEssay = totalWeight > 0 ? participant.essay_weight / totalWeight : 0.3;
      finalScore = Number((pgPercent * wPg + essayPercent * wEssay).toFixed(2));
    }
    passed = finalScore >= participant.passing_grade ? 1 : 0;
  }

  db.prepare(`
    INSERT INTO exam_results (
      exam_id, participant_id, student_id, pg_correct, pg_total, pg_score,
      essay_score, essay_graded, final_score, passed, calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    ON CONFLICT(participant_id) DO UPDATE SET
      pg_correct = excluded.pg_correct,
      pg_total = excluded.pg_total,
      pg_score = excluded.pg_score,
      essay_score = excluded.essay_score,
      essay_graded = excluded.essay_graded,
      final_score = excluded.final_score,
      passed = excluded.passed,
      calculated_at = datetime('now', 'localtime')
  `).run(
    participant.exam_id,
    participantId,
    participant.student_id,
    pgCorrect,
    pgTotal,
    Number(pgPercent.toFixed(2)),
    Number(essayPercent.toFixed(2)),
    essayCount === 0 || allEssaysGraded ? 1 : 0,
    finalScore,
    passed
  );
}

// List Exams
router.get('/', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const status = req.query.status ? String(req.query.status) : '';
  const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
  const classId = req.query.class_id ? Number(req.query.class_id) : null;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (req.user!.role === 'guru') {
    where += ' AND e.created_by = ?';
    params.push(req.user!.userId);
  }
  if (status) {
    where += ' AND e.status = ?';
    params.push(status);
  }
  if (subjectId) {
    where += ' AND e.subject_id = ?';
    params.push(subjectId);
  }
  if (classId) {
    where += ' AND e.class_id = ?';
    params.push(classId);
  }

  const exams = db.prepare(`
    SELECT e.*,
           s.name AS subject_name, s.code AS subject_code,
           c.name AS class_name,
           d.code AS department_code, d.name AS department_name,
           qb.title AS bank_title,
           u.full_name AS creator_name,
           (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS assigned_questions,
           (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) AS participant_count,
           (SELECT COUNT(*) FROM students st WHERE st.class_id = e.class_id) AS class_student_count
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    JOIN classes c ON c.id = e.class_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN question_banks qb ON qb.id = e.bank_id
    JOIN users u ON u.id = e.created_by
    ${where}
    ORDER BY e.exam_date DESC, e.id DESC
  `).all(...params);

  res.json({ exams });
});

// Get single exam detail + assigned questions
router.get('/:id', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const exam = db.prepare(`
    SELECT e.*, s.name AS subject_name, c.name AS class_name, d.name AS department_name, qb.title AS bank_title
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    JOIN classes c ON c.id = e.class_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN question_banks qb ON qb.id = e.bank_id
    WHERE e.id = ?
  `).get(req.params.id) as any;

  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && exam.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda tidak berhak mengakses ujian ini.' });
    return;
  }

  const questions = db.prepare(`
    SELECT q.*, eq.order_index
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.order_index ASC
  `).all(exam.id);

  res.json({ exam, questions });
});

// Create Exam
router.post('/', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const {
    title, subject_id, class_id, department_id, bank_id,
    exam_date, start_time, end_time, duration_minutes, question_count,
    pg_weight, essay_weight, passing_grade, shuffle_questions, shuffle_options, show_result, status, instructions,
    selected_question_ids,
  } = req.body || {};

  if (!title || !subject_id || !class_id || !exam_date || !start_time || !end_time) {
    res.status(400).json({ error: 'Nama ujian, mapel, kelas, tanggal, dan jam ujian wajib diisi.' });
    return;
  }

  const db = getDb();
  const duration = Math.max(5, Number(duration_minutes) || 60);
  const qCount = Math.max(1, Number(question_count) || 10);

  let questionIds: number[] = Array.isArray(selected_question_ids)
    ? selected_question_ids.map(Number).filter((n) => Number.isFinite(n))
    : [];

  if (questionIds.length === 0 && bank_id) {
    const bankQuestions = db.prepare('SELECT id FROM questions WHERE bank_id = ? ORDER BY id ASC LIMIT ?').all(
      Number(bank_id),
      qCount
    ) as Array<{ id: number }>;
    questionIds = bankQuestions.map((q) => q.id);
  }

  const tx = db.transaction(() => {
    const examRes = db.prepare(`
      INSERT INTO exams (
        title, subject_id, class_id, department_id, bank_id, created_by,
        exam_date, start_time, end_time, duration_minutes, question_count,
        pg_weight, essay_weight, passing_grade, shuffle_questions, shuffle_options, show_result, status, instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(title).trim(),
      Number(subject_id),
      Number(class_id),
      department_id ? Number(department_id) : null,
      bank_id ? Number(bank_id) : null,
      req.user!.userId,
      String(exam_date).trim(),
      String(start_time).trim(),
      String(end_time).trim(),
      duration,
      questionIds.length > 0 ? questionIds.length : qCount,
      Number(pg_weight ?? 70),
      Number(essay_weight ?? 30),
      Number(passing_grade ?? 75),
      shuffle_questions ? 1 : 0,
      shuffle_options ? 1 : 0,
      show_result ? 1 : 0,
      ['Draft', 'Terjadwal', 'Berlangsung', 'Selesai', 'Dibatalkan'].includes(status) ? status : 'Terjadwal',
      String(instructions || 'Bacalah setiap soal dengan teliti sebelum memilih atau menuliskan jawaban.').trim()
    );

    const newExamId = Number(examRes.lastInsertRowid);
    const insEQ = db.prepare('INSERT INTO exam_questions (exam_id, question_id, order_index) VALUES (?, ?, ?)');
    questionIds.forEach((qid, idx) => insEQ.run(newExamId, qid, idx));
    return newExamId;
  });

  const examId = tx();
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'CREATE_EXAM',
    entityType: 'exam',
    entityId: examId,
    details: `Membuat ujian "${String(title).trim()}" dengan ${questionIds.length} soal.`,
    ipAddress: getClientIp(req),
  });

  res.status(201).json({ id: examId, message: 'Ujian berhasil dibuat.' });
});

// Update Exam
router.put('/:id', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT created_by FROM exams WHERE id = ?').get(id) as { created_by: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && existing.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda tidak berhak mengubah ujian ini.' });
    return;
  }

  const {
    title, subject_id, class_id, department_id, bank_id,
    exam_date, start_time, end_time, duration_minutes, question_count,
    pg_weight, essay_weight, passing_grade, shuffle_questions, shuffle_options, show_result, status, instructions,
    selected_question_ids,
  } = req.body || {};

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE exams SET
        title = ?, subject_id = ?, class_id = ?, department_id = ?, bank_id = ?,
        exam_date = ?, start_time = ?, end_time = ?, duration_minutes = ?, question_count = ?,
        pg_weight = ?, essay_weight = ?, passing_grade = ?,
        shuffle_questions = ?, shuffle_options = ?, show_result = ?, status = ?, instructions = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      String(title).trim(),
      Number(subject_id),
      Number(class_id),
      department_id ? Number(department_id) : null,
      bank_id ? Number(bank_id) : null,
      String(exam_date).trim(),
      String(start_time).trim(),
      String(end_time).trim(),
      Math.max(5, Number(duration_minutes) || 60),
      Math.max(1, Number(question_count) || 10),
      Number(pg_weight ?? 70),
      Number(essay_weight ?? 30),
      Number(passing_grade ?? 75),
      shuffle_questions ? 1 : 0,
      shuffle_options ? 1 : 0,
      show_result ? 1 : 0,
      ['Draft', 'Terjadwal', 'Berlangsung', 'Selesai', 'Dibatalkan'].includes(status) ? status : 'Terjadwal',
      String(instructions || '').trim(),
      id
    );

    if (Array.isArray(selected_question_ids)) {
      db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(id);
      const insEQ = db.prepare('INSERT INTO exam_questions (exam_id, question_id, order_index) VALUES (?, ?, ?)');
      selected_question_ids.map(Number).filter(Number.isFinite).forEach((qid: number, idx: number) => {
        insEQ.run(id, qid, idx);
      });
    }
  });

  tx();
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'UPDATE_EXAM',
    entityType: 'exam',
    entityId: id,
    details: `Memperbarui konfigurasi ujian "${String(title).trim()}" (Status: ${status}).`,
    ipAddress: getClientIp(req),
  });

  res.json({ message: 'Data ujian berhasil diperbarui.' });
});

router.delete('/:id', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT created_by, title FROM exams WHERE id = ?').get(id) as
    | { created_by: number; title: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && existing.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda tidak berhak menghapus ujian ini.' });
    return;
  }
  db.prepare('DELETE FROM exams WHERE id = ?').run(id);
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'DELETE_EXAM',
    entityType: 'exam',
    entityId: id,
    details: `Menghapus ujian "${existing.title}".`,
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Ujian berhasil dihapus.' });
});

// Live Exam Monitoring
router.get('/:id/monitoring', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const exam = db.prepare(`
    SELECT e.*, s.name AS subject_name, c.name AS class_name
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    JOIN classes c ON c.id = e.class_id
    WHERE e.id = ?
  `).get(req.params.id) as any;

  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && exam.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Akses monitoring ditolak.' });
    return;
  }

  const totalQuestions = (db.prepare('SELECT COUNT(*) AS cnt FROM exam_questions WHERE exam_id = ?').get(exam.id) as { cnt: number }).cnt;

  const classStudents = db.prepare(`
    SELECT st.id AS student_id, st.nis, st.participant_number, u.id AS user_id, u.full_name, u.username,
           ep.id AS participant_id, ep.status, ep.started_at, ep.expires_at, ep.submitted_at, ep.last_seen_at, ep.ip_address
    FROM students st
    JOIN users u ON u.id = st.user_id
    LEFT JOIN exam_participants ep ON ep.student_id = st.id AND ep.exam_id = ?
    WHERE st.class_id = ?
    ORDER BY u.full_name ASC
  `).all(exam.id, exam.class_id) as any[];

  const nowMs = Date.now();
  const rows = classStudents.map((row) => {
    let answeredCount = 0;
    if (row.participant_id) {
      answeredCount = (db.prepare(`
        SELECT COUNT(*) AS cnt FROM answers
        WHERE participant_id = ? AND TRIM(answer_text) != ''
      `).get(row.participant_id) as { cnt: number }).cnt;
    }

    let computedStatus = row.status || 'belum_mulai';
    let remainingSeconds = exam.duration_minutes * 60;

    if (row.participant_id) {
      if (row.expires_at) {
        const expMs = new Date(row.expires_at.replace(' ', 'T')).getTime();
        remainingSeconds = Math.max(0, Math.floor((expMs - nowMs) / 1000));
      }
      if (computedStatus === 'sedang_mengerjakan') {
        if (remainingSeconds <= 0) {
          computedStatus = 'waktu_habis';
        } else if (row.last_seen_at) {
          const lastSeenMs = new Date(row.last_seen_at.replace(' ', 'T')).getTime();
          if (nowMs - lastSeenMs > 45 * 1000) {
            computedStatus = 'terputus';
          }
        }
      }
    }

    const recentActivity = row.user_id
      ? db.prepare(`
          SELECT action, details, ip_address, created_at
          FROM activity_logs
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT 5
        `).all(row.user_id)
      : [];

    return {
      studentId: row.student_id,
      participantId: row.participant_id,
      fullName: row.full_name,
      nis: row.nis,
      participantNumber: row.participant_number,
      status: computedStatus,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      lastSeenAt: row.last_seen_at,
      ipAddress: row.ip_address,
      remainingSeconds,
      answeredCount,
      unansweredCount: Math.max(0, totalQuestions - answeredCount),
      totalQuestions,
      recentActivity,
    };
  });

  res.json({ exam, totalQuestions, participants: rows, serverTime: new Date().toISOString() });
});

// Teacher Force-Finish Participant Exam
router.post('/:id/force-finish/:participantId', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { id, participantId } = req.params;
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE exam_participants
      SET status = 'selesai', submitted_at = COALESCE(submitted_at, datetime('now', 'localtime'))
      WHERE id = ? AND exam_id = ?
    `).run(participantId, id);
    recalculateParticipantResult(Number(participantId));
  });
  tx();

  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'FORCE_FINISH_PARTICIPANT',
    entityType: 'exam_participant',
    entityId: participantId,
    details: `Guru/Admin mengakhiri paksa sesi peserta ID ${participantId} pada ujian ID ${id}.`,
    ipAddress: getClientIp(req),
  });

  res.json({ message: 'Sesi ujian peserta berhasil diakhiri dan nilai PG dihitung.' });
});

// Grading View: Participant scores & Essay answers to grade
router.get('/:id/grading', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const exam = db.prepare(`
    SELECT e.*, s.name AS subject_name, c.name AS class_name
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    JOIN classes c ON c.id = e.class_id
    WHERE e.id = ?
  `).get(req.params.id) as any;

  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }

  const participants = db.prepare(`
    SELECT ep.id AS participant_id, ep.status, ep.started_at, ep.submitted_at,
           st.id AS student_id, st.nis, st.participant_number, u.full_name,
           er.pg_correct, er.pg_total, er.pg_score, er.essay_score, er.essay_graded, er.final_score, er.passed
    FROM exam_participants ep
    JOIN students st ON st.id = ep.student_id
    JOIN users u ON u.id = st.user_id
    LEFT JOIN exam_results er ON er.participant_id = ep.id
    WHERE ep.exam_id = ?
    ORDER BY u.full_name ASC
  `).all(exam.id) as any[];

  const essays = db.prepare(`
    SELECT eg.id AS grade_id, eg.answer_id, eg.participant_id, eg.question_id,
           eg.score, eg.max_score, eg.feedback, eg.status, eg.graded_at,
           q.question_code, q.question_text,
           a.answer_text,
           u.full_name AS student_name, st.nis, st.participant_number
    FROM essay_grades eg
    JOIN answers a ON a.id = eg.answer_id
    JOIN questions q ON q.id = eg.question_id
    JOIN exam_participants ep ON ep.id = eg.participant_id
    JOIN students st ON st.id = ep.student_id
    JOIN users u ON u.id = st.user_id
    WHERE ep.exam_id = ?
    ORDER BY eg.status ASC, u.full_name ASC, q.id ASC
  `).all(exam.id);

  res.json({ exam, participants, essays });
});

// Grade Single Essay Answer
router.post('/:id/grade-essay', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { grade_id, score, feedback } = req.body || {};
  if (!grade_id || score === undefined) {
    res.status(400).json({ error: 'ID penilaian esai dan skor wajib diisi.' });
    return;
  }

  const db = getDb();
  const grade = db.prepare('SELECT id, participant_id, answer_id, max_score FROM essay_grades WHERE id = ?').get(Number(grade_id)) as
    | { id: number; participant_id: number; answer_id: number; max_score: number }
    | undefined;

  if (!grade) {
    res.status(404).json({ error: 'Data jawaban esai tidak ditemukan.' });
    return;
  }

  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore < 0 || numScore > grade.max_score) {
    res.status(400).json({ error: `Skor esai harus berada di antara 0 sampai ${grade.max_score}.` });
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE essay_grades
      SET score = ?, feedback = ?, status = 'sudah_dinilai', graded_by = ?, graded_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(numScore, String(feedback || '').trim(), req.user!.userId, grade.id);

    db.prepare('UPDATE answers SET earned_score = ? WHERE id = ?').run(numScore, grade.answer_id);
    recalculateParticipantResult(grade.participant_id);
  });

  tx();

  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'GRADE_ESSAY',
    entityType: 'essay_grade',
    entityId: grade.id,
    details: `Memberikan nilai esai ${numScore}/${grade.max_score} pada grade ID ${grade.id}.`,
    ipAddress: getClientIp(req),
  });

  res.json({ message: 'Nilai esai berhasil disimpan dan nilai akhir diperbarui.' });
});

// Reports & Analytics (across filters or specific exam)
router.get('/:id/report', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const exam = db.prepare(`
    SELECT e.*, s.name AS subject_name, s.code AS subject_code,
           c.name AS class_name, d.name AS department_name, u.full_name AS teacher_name
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    JOIN classes c ON c.id = e.class_id
    LEFT JOIN departments d ON d.id = e.department_id
    JOIN users u ON u.id = e.created_by
    WHERE e.id = ?
  `).get(req.params.id) as any;

  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }

  const school = db.prepare('SELECT * FROM schools LIMIT 1').get();

  const results = db.prepare(`
    SELECT er.*, st.nis, st.participant_number, u.full_name AS student_name,
           c.name AS class_name, ep.started_at, ep.submitted_at, ep.status AS participant_status
    FROM exam_results er
    JOIN exam_participants ep ON ep.id = er.participant_id
    JOIN students st ON st.id = er.student_id
    JOIN users u ON u.id = st.user_id
    LEFT JOIN classes c ON c.id = st.class_id
    WHERE er.exam_id = ?
    ORDER BY COALESCE(er.final_score, -1) DESC, er.pg_score DESC, u.full_name ASC
  `).all(exam.id) as any[];

  const finalizedScores = results.filter((r) => r.final_score !== null).map((r) => Number(r.final_score));
  const avgScore = finalizedScores.length > 0 ? Number((finalizedScores.reduce((a, b) => a + b, 0) / finalizedScores.length).toFixed(2)) : 0;
  const maxScore = finalizedScores.length > 0 ? Math.max(...finalizedScores) : 0;
  const minScore = finalizedScores.length > 0 ? Math.min(...finalizedScores) : 0;
  const passedCount = results.filter((r) => r.passed === 1).length;
  const passRate = finalizedScores.length > 0 ? Number(((passedCount / finalizedScores.length) * 100).toFixed(1)) : 0;

  // Question Item Analysis
  const examQuestions = db.prepare(`
    SELECT q.id, q.question_code, q.question_type, q.question_text, q.correct_answer, q.score
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.order_index ASC
  `).all(exam.id) as any[];

  const itemAnalysis = examQuestions.map((q, index) => {
    const ansStats = db.prepare(`
      SELECT
        COUNT(*) AS total_answered,
        SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
        AVG(a.earned_score) AS avg_score
      FROM answers a
      JOIN exam_participants ep ON ep.id = a.participant_id
      WHERE ep.exam_id = ? AND a.question_id = ?
    `).get(exam.id, q.id) as { total_answered: number; correct_count: number; avg_score: number | null };

    const total = ansStats.total_answered || 0;
    const correct = ansStats.correct_count || 0;
    const correctRate = q.question_type === 'PG' && total > 0 ? Number(((correct / total) * 100).toFixed(1)) : null;

    return {
      no: index + 1,
      questionId: q.id,
      questionCode: q.question_code,
      questionType: q.question_type,
      questionText: q.question_text,
      maxScore: q.score,
      totalAnswered: total,
      correctCount: correct,
      correctRate,
      avgScore: ansStats.avg_score !== null ? Number(ansStats.avg_score.toFixed(2)) : 0,
    };
  });

  const essaySummary = db.prepare(`
    SELECT eg.id, st.nis, u.full_name AS student_name, q.question_code, q.question_text,
           a.answer_text, eg.score, eg.max_score, eg.status, eg.feedback
    FROM essay_grades eg
    JOIN answers a ON a.id = eg.answer_id
    JOIN questions q ON q.id = eg.question_id
    JOIN exam_participants ep ON ep.id = eg.participant_id
    JOIN students st ON st.id = ep.student_id
    JOIN users u ON u.id = st.user_id
    WHERE ep.exam_id = ?
    ORDER BY u.full_name ASC, q.id ASC
  `).all(exam.id);

  res.json({
    school,
    exam,
    summary: {
      totalParticipants: results.length,
      finalizedCount: finalizedScores.length,
      pendingEssayCount: results.filter((r) => r.essay_graded === 0).length,
      avgScore,
      maxScore,
      minScore,
      passedCount,
      passRate,
    },
    ranking: results.map((r, idx) => ({ rank: idx + 1, ...r })),
    itemAnalysis,
    essaySummary,
  });
});

// Export Exam Report to Excel
router.get('/:id/export-excel', requireAuth, requireRole('admin', 'guru'), async (req, res) => {
  try {
    const db = getDb();
    const exam = db.prepare(`
      SELECT e.*, s.name AS subject_name, c.name AS class_name, u.full_name AS teacher_name
      FROM exams e
      JOIN subjects s ON s.id = e.subject_id
      JOIN classes c ON c.id = e.class_id
      JOIN users u ON u.id = e.created_by
      WHERE e.id = ?
    `).get(req.params.id) as any;

    if (!exam) {
      res.status(404).json({ error: 'Ujian tidak ditemukan.' });
      return;
    }

    const school = db.prepare('SELECT name FROM schools LIMIT 1').get() as { name: string } | undefined;
    const results = db.prepare(`
      SELECT er.*, st.nis, st.participant_number, u.full_name AS student_name, c.name AS class_name
      FROM exam_results er
      JOIN students st ON st.id = er.student_id
      JOIN users u ON u.id = st.user_id
      LEFT JOIN classes c ON c.id = st.class_id
      WHERE er.exam_id = ?
      ORDER BY COALESCE(er.final_score, -1) DESC, er.pg_score DESC, u.full_name ASC
    `).all(exam.id) as any[];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GHIFARI CBT - MARGUMI STUDIO';

    const sheet = workbook.addWorksheet('REKAP NILAI');
    sheet.addRow([`GHIFARI CBT — ${school?.name || 'SMK AL-GHIFARI'}`]);
    sheet.addRow([`Laporan Hasil Ujian: ${exam.title}`]);
    sheet.addRow([`Mata Pelajaran: ${exam.subject_name} | Kelas: ${exam.class_name} | Tanggal: ${exam.exam_date} | KKM: ${exam.passing_grade}`]);
    sheet.addRow([]);

    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF102B50' } };
    sheet.getRow(2).font = { bold: true, size: 12 };

    const headers = ['Peringkat', 'NIS', 'No. Peserta', 'Nama Siswa', 'Kelas', 'PG Benar', 'Nilai PG', 'Nilai Esai', 'Status Esai', 'Nilai Akhir', 'Keterangan'];
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102B50' } };

    results.forEach((r, idx) => {
      sheet.addRow([
        idx + 1,
        r.nis,
        r.participant_number,
        r.student_name,
        r.class_name,
        `${r.pg_correct}/${r.pg_total}`,
        r.pg_score,
        r.essay_graded ? r.essay_score : 'Belum Dinilai',
        r.essay_graded ? 'Sudah Dinilai' : 'Menunggu Nilai Esai',
        r.final_score !== null ? r.final_score : 'Menunggu Esai',
        r.passed === 1 ? 'Lulus' : r.passed === 0 ? 'Tidak Lulus' : 'Belum Final',
      ]);
    });

    sheet.addRow([]);
    sheet.addRow(['Developed by MARGUMI STUDIO']);

    sheet.columns.forEach((col) => {
      col.width = 18;
    });
    sheet.getColumn(4).width = 28;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-ujian-${exam.id}-ghifari-cbt.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Gagal mengekspor laporan Excel.' });
  }
});

export default router;
