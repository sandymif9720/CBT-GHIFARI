import { Router } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import Database from 'better-sqlite3';
import { closeDb, DB_PATH, getDb, initDatabase } from '../database/db.ts';
import { type AuthenticatedRequest, getClientIp, logActivity, requireAuth, requireRole } from '../utils/auth.ts';

const router = Router();
const uploadBackup = multer({
  dest: path.resolve(process.cwd(), 'backend', 'uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

function getLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const ifaceList of Object.values(interfaces)) {
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Shared Dashboard summary for Admin & Guru
router.get('/dashboard', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const isTeacher = req.user!.role === 'guru';

  const totalStudents = (db.prepare('SELECT COUNT(*) AS cnt FROM students').get() as { cnt: number }).cnt;
  const totalTeachers = (db.prepare('SELECT COUNT(*) AS cnt FROM teachers').get() as { cnt: number }).cnt;
  const totalClasses = (db.prepare('SELECT COUNT(*) AS cnt FROM classes').get() as { cnt: number }).cnt;
  const totalSubjects = (db.prepare('SELECT COUNT(*) AS cnt FROM subjects').get() as { cnt: number }).cnt;
  const totalBanks = isTeacher
    ? (db.prepare('SELECT COUNT(*) AS cnt FROM question_banks WHERE created_by = ?').get(req.user!.userId) as { cnt: number }).cnt
    : (db.prepare('SELECT COUNT(*) AS cnt FROM question_banks').get() as { cnt: number }).cnt;
  const totalQuestions = isTeacher
    ? (db.prepare('SELECT COUNT(*) AS cnt FROM questions WHERE created_by = ?').get(req.user!.userId) as { cnt: number }).cnt
    : (db.prepare('SELECT COUNT(*) AS cnt FROM questions').get() as { cnt: number }).cnt;
  const totalExams = isTeacher
    ? (db.prepare('SELECT COUNT(*) AS cnt FROM exams WHERE created_by = ?').get(req.user!.userId) as { cnt: number }).cnt
    : (db.prepare('SELECT COUNT(*) AS cnt FROM exams').get() as { cnt: number }).cnt;
  const activeExams = isTeacher
    ? (db.prepare("SELECT COUNT(*) AS cnt FROM exams WHERE status = 'Berlangsung' AND created_by = ?").get(req.user!.userId) as { cnt: number }).cnt
    : (db.prepare("SELECT COUNT(*) AS cnt FROM exams WHERE status = 'Berlangsung'").get() as { cnt: number }).cnt;

  const totalParticipants = isTeacher
    ? (db.prepare(`
        SELECT COUNT(*) AS cnt FROM exam_participants ep
        JOIN exams e ON e.id = ep.exam_id
        WHERE e.created_by = ?
      `).get(req.user!.userId) as { cnt: number }).cnt
    : (db.prepare('SELECT COUNT(*) AS cnt FROM exam_participants').get() as { cnt: number }).cnt;

  const pendingEssays = isTeacher
    ? (db.prepare(`
        SELECT COUNT(*) AS cnt FROM essay_grades eg
        JOIN exam_participants ep ON ep.id = eg.participant_id
        JOIN exams e ON e.id = ep.exam_id
        WHERE eg.status = 'belum_dinilai' AND e.created_by = ?
      `).get(req.user!.userId) as { cnt: number }).cnt
    : (db.prepare("SELECT COUNT(*) AS cnt FROM essay_grades WHERE status = 'belum_dinilai'").get() as { cnt: number }).cnt;

  const recentLogs = db.prepare(`
    SELECT id, username, role, action, entity_type, details, ip_address, created_at
    FROM activity_logs
    ORDER BY id DESC
    LIMIT 10
  `).all();

  const recentResults = db.prepare(`
    SELECT er.id, er.exam_id, e.title AS exam_title, s.name AS subject_name,
           u.full_name AS student_name, st.nis, c.name AS class_name,
           er.pg_score, er.essay_score, er.essay_graded, er.final_score, er.passed, er.calculated_at
    FROM exam_results er
    JOIN exams e ON e.id = er.exam_id
    JOIN subjects s ON s.id = e.subject_id
    JOIN students st ON st.id = er.student_id
    JOIN users u ON u.id = st.user_id
    LEFT JOIN classes c ON c.id = st.class_id
    ${isTeacher ? 'WHERE e.created_by = ?' : ''}
    ORDER BY er.calculated_at DESC
    LIMIT 8
  `).all(...(isTeacher ? [req.user!.userId] : []));

  const runningExams = db.prepare(`
    SELECT e.id, e.title, e.exam_date, e.start_time, e.end_time, e.duration_minutes, e.status,
           s.name AS subject_name, c.name AS class_name,
           (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status = 'sedang_mengerjakan') AS active_participants,
           (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id AND ep.status IN ('selesai', 'waktu_habis')) AS finished_participants
    FROM exams e
    JOIN subjects s ON s.id = e.subject_id
    JOIN classes c ON c.id = e.class_id
    WHERE e.status IN ('Berlangsung', 'Terjadwal')
    ${isTeacher ? 'AND e.created_by = ?' : ''}
    ORDER BY e.exam_date ASC, e.start_time ASC
    LIMIT 6
  `).all(...(isTeacher ? [req.user!.userId] : []));

  res.json({
    stats: {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      totalBanks,
      totalQuestions,
      totalExams,
      activeExams,
      totalParticipants,
      pendingEssays,
    },
    recentLogs,
    recentResults,
    runningExams,
    lanIps: getLanIps(),
  });
});

// Shared Master Reference for Admin & Guru
router.get('/master/references', requireAuth, requireRole('admin', 'guru'), (_req, res) => {
  const db = getDb();
  const departments = db.prepare('SELECT * FROM departments ORDER BY code ASC').all();
  const classes = db.prepare(`
    SELECT c.*, d.code AS department_code, d.name AS department_name
    FROM classes c LEFT JOIN departments d ON d.id = c.department_id
    ORDER BY c.grade_level ASC, c.name ASC
  `).all();
  const subjects = db.prepare(`
    SELECT s.*, d.code AS department_code, d.name AS department_name
    FROM subjects s LEFT JOIN departments d ON d.id = s.department_id
    ORDER BY s.name ASC
  `).all();
  res.json({ departments, classes, subjects });
});

// School Identity (Admin)
router.get('/school', requireAuth, requireRole('admin', 'guru'), (_req, res) => {
  const db = getDb();
  const school = db.prepare('SELECT * FROM schools LIMIT 1').get();
  res.json({ school });
});

router.put('/school', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { name, npsn, address, phone, email, principal_name, academic_year, semester } = req.body || {};
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'Nama sekolah wajib diisi.' });
    return;
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM schools LIMIT 1').get() as { id: number } | undefined;
  if (existing) {
    db.prepare(`
      UPDATE schools
      SET name = ?, npsn = ?, address = ?, phone = ?, email = ?, principal_name = ?, academic_year = ?, semester = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      String(name).trim(),
      String(npsn || '').trim(),
      String(address || '').trim(),
      String(phone || '').trim(),
      String(email || '').trim(),
      String(principal_name || '').trim(),
      String(academic_year || '2026/2027').trim(),
      String(semester || 'Ganjil').trim(),
      existing.id
    );
  }
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'UPDATE_SCHOOL',
    entityType: 'school',
    entityId: existing?.id || 1,
    details: `Memperbarui identitas sekolah: ${String(name).trim()}.`,
    ipAddress: getClientIp(req),
  });
  const school = db.prepare('SELECT * FROM schools LIMIT 1').get();
  res.json({ school, message: 'Identitas sekolah berhasil diperbarui.' });
});

// Departments CRUD (Admin)
router.get('/departments', requireAuth, requireRole('admin', 'guru'), (_req, res) => {
  const db = getDb();
  const departments = db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM classes c WHERE c.department_id = d.id) AS class_count,
      (SELECT COUNT(*) FROM students s WHERE s.department_id = d.id) AS student_count
    FROM departments d
    ORDER BY d.code ASC
  `).all();
  res.json({ departments });
});

router.post('/departments', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { code, name, description } = req.body || {};
  if (!code || !name) {
    res.status(400).json({ error: 'Kode dan nama jurusan wajib diisi.' });
    return;
  }
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO departments (code, name, description) VALUES (?, ?, ?)').run(
      String(code).trim().toUpperCase(),
      String(name).trim(),
      String(description || '').trim()
    );
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'CREATE_DEPARTMENT',
      entityType: 'department',
      entityId: Number(result.lastInsertRowid),
      details: `Menambahkan jurusan ${String(code).trim().toUpperCase()} - ${String(name).trim()}.`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ id: result.lastInsertRowid, message: 'Jurusan berhasil ditambahkan.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message?.includes('UNIQUE') ? 'Kode jurusan sudah digunakan.' : 'Gagal menambahkan jurusan.' });
  }
});

router.put('/departments/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { code, name, description } = req.body || {};
  if (!code || !name) {
    res.status(400).json({ error: 'Kode dan nama jurusan wajib diisi.' });
    return;
  }
  const db = getDb();
  try {
    db.prepare('UPDATE departments SET code = ?, name = ?, description = ? WHERE id = ?').run(
      String(code).trim().toUpperCase(),
      String(name).trim(),
      String(description || '').trim(),
      id
    );
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'UPDATE_DEPARTMENT',
      entityType: 'department',
      entityId: id,
      details: `Memperbarui jurusan ${String(code).trim().toUpperCase()} - ${String(name).trim()}.`,
      ipAddress: getClientIp(req),
    });
    res.json({ message: 'Jurusan berhasil diperbarui.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message?.includes('UNIQUE') ? 'Kode jurusan sudah digunakan.' : 'Gagal memperbarui jurusan.' });
  }
});

router.delete('/departments/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'DELETE_DEPARTMENT',
    entityType: 'department',
    entityId: id,
    details: `Menghapus data jurusan ID ${id}.`,
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Jurusan berhasil dihapus.' });
});

// Classes CRUD (Admin)
router.get('/classes', requireAuth, requireRole('admin', 'guru'), (_req, res) => {
  const db = getDb();
  const classes = db.prepare(`
    SELECT c.*, d.code AS department_code, d.name AS department_name,
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count
    FROM classes c
    LEFT JOIN departments d ON d.id = c.department_id
    ORDER BY c.grade_level ASC, c.name ASC
  `).all();
  res.json({ classes });
});

router.post('/classes', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { name, grade_level, department_id, academic_year } = req.body || {};
  if (!name || !grade_level) {
    res.status(400).json({ error: 'Nama kelas dan tingkat wajib diisi.' });
    return;
  }
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO classes (name, grade_level, department_id, academic_year) VALUES (?, ?, ?, ?)').run(
      String(name).trim(),
      String(grade_level).trim(),
      department_id ? Number(department_id) : null,
      String(academic_year || '2026/2027').trim()
    );
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'CREATE_CLASS',
      entityType: 'class',
      entityId: Number(result.lastInsertRowid),
      details: `Menambahkan kelas ${String(name).trim()}.`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ id: result.lastInsertRowid, message: 'Kelas berhasil ditambahkan.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message?.includes('UNIQUE') ? 'Nama kelas sudah ada.' : 'Gagal menambahkan kelas.' });
  }
});

router.put('/classes/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, grade_level, department_id, academic_year } = req.body || {};
  if (!name || !grade_level) {
    res.status(400).json({ error: 'Nama kelas dan tingkat wajib diisi.' });
    return;
  }
  const db = getDb();
  try {
    db.prepare('UPDATE classes SET name = ?, grade_level = ?, department_id = ?, academic_year = ? WHERE id = ?').run(
      String(name).trim(),
      String(grade_level).trim(),
      department_id ? Number(department_id) : null,
      String(academic_year || '2026/2027').trim(),
      id
    );
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'UPDATE_CLASS',
      entityType: 'class',
      entityId: id,
      details: `Memperbarui kelas ${String(name).trim()}.`,
      ipAddress: getClientIp(req),
    });
    res.json({ message: 'Kelas berhasil diperbarui.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message?.includes('UNIQUE') ? 'Nama kelas sudah ada.' : 'Gagal memperbarui kelas.' });
  }
});

router.delete('/classes/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  db.prepare('DELETE FROM classes WHERE id = ?').run(id);
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'DELETE_CLASS',
    entityType: 'class',
    entityId: id,
    details: `Menghapus kelas ID ${id}.`,
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Kelas berhasil dihapus.' });
});

// Subjects CRUD (Admin)
router.get('/subjects', requireAuth, requireRole('admin', 'guru'), (_req, res) => {
  const db = getDb();
  const subjects = db.prepare(`
    SELECT s.*, d.code AS department_code, d.name AS department_name,
      (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id) AS question_count
    FROM subjects s
    LEFT JOIN departments d ON d.id = s.department_id
    ORDER BY s.name ASC
  `).all();
  res.json({ subjects });
});

router.post('/subjects', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { code, name, department_id, description } = req.body || {};
  if (!code || !name) {
    res.status(400).json({ error: 'Kode dan nama mata pelajaran wajib diisi.' });
    return;
  }
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO subjects (code, name, department_id, description) VALUES (?, ?, ?, ?)').run(
      String(code).trim().toUpperCase(),
      String(name).trim(),
      department_id ? Number(department_id) : null,
      String(description || '').trim()
    );
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'CREATE_SUBJECT',
      entityType: 'subject',
      entityId: Number(result.lastInsertRowid),
      details: `Menambahkan mata pelajaran ${String(code).trim().toUpperCase()} - ${String(name).trim()}.`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ id: result.lastInsertRowid, message: 'Mata pelajaran berhasil ditambahkan.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message?.includes('UNIQUE') ? 'Kode mata pelajaran sudah digunakan.' : 'Gagal menambahkan mata pelajaran.' });
  }
});

router.put('/subjects/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { code, name, department_id, description } = req.body || {};
  if (!code || !name) {
    res.status(400).json({ error: 'Kode dan nama mata pelajaran wajib diisi.' });
    return;
  }
  const db = getDb();
  try {
    db.prepare('UPDATE subjects SET code = ?, name = ?, department_id = ?, description = ? WHERE id = ?').run(
      String(code).trim().toUpperCase(),
      String(name).trim(),
      department_id ? Number(department_id) : null,
      String(description || '').trim(),
      id
    );
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'UPDATE_SUBJECT',
      entityType: 'subject',
      entityId: id,
      details: `Memperbarui mata pelajaran ${String(code).trim().toUpperCase()} - ${String(name).trim()}.`,
      ipAddress: getClientIp(req),
    });
    res.json({ message: 'Mata pelajaran berhasil diperbarui.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message?.includes('UNIQUE') ? 'Kode mata pelajaran sudah digunakan.' : 'Gagal memperbarui mata pelajaran.' });
  }
});

router.delete('/subjects/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'DELETE_SUBJECT',
    entityType: 'subject',
    entityId: id,
    details: `Menghapus mata pelajaran ID ${id}.`,
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Mata pelajaran berhasil dihapus.' });
});

// Teachers CRUD (Admin)
router.get('/teachers', requireAuth, requireRole('admin'), (_req, res) => {
  const db = getDb();
  const teachers = db.prepare(`
    SELECT t.id, t.user_id, u.username, u.full_name, u.is_active, u.last_login_at,
           t.nip, t.phone, t.email, t.specialization, t.created_at
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    ORDER BY u.full_name ASC
  `).all();
  res.json({ teachers });
});

router.post('/teachers', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { username, password, full_name, nip, phone, email, specialization } = req.body || {};
  if (!username || !password || !full_name) {
    res.status(400).json({ error: 'Username, kata sandi, dan nama lengkap guru wajib diisi.' });
    return;
  }
  const db = getDb();
  const hash = bcrypt.hashSync(String(password), 10);
  try {
    const tx = db.transaction(() => {
      const uRes = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
        String(username).trim(),
        hash,
        String(full_name).trim(),
        'guru'
      );
      const tRes = db.prepare('INSERT INTO teachers (user_id, nip, phone, email, specialization) VALUES (?, ?, ?, ?, ?)').run(
        uRes.lastInsertRowid,
        String(nip || '').trim(),
        String(phone || '').trim(),
        String(email || '').trim(),
        String(specialization || '').trim()
      );
      return Number(tRes.lastInsertRowid);
    });
    const teacherId = tx();
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'CREATE_TEACHER',
      entityType: 'teacher',
      entityId: teacherId,
      details: `Menambahkan akun guru ${String(full_name).trim()} (${String(username).trim()}).`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ id: teacherId, message: 'Data guru berhasil ditambahkan.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message?.includes('UNIQUE') ? 'Username guru sudah terdaftar.' : 'Gagal menambahkan data guru.' });
  }
});

router.put('/teachers/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { username, password, full_name, nip, phone, email, specialization, is_active } = req.body || {};
  if (!username || !full_name) {
    res.status(400).json({ error: 'Username dan nama lengkap guru wajib diisi.' });
    return;
  }
  const db = getDb();
  const existing = db.prepare('SELECT user_id FROM teachers WHERE id = ?').get(id) as { user_id: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Data guru tidak ditemukan.' });
    return;
  }
  try {
    const tx = db.transaction(() => {
      if (password && String(password).trim().length >= 6) {
        const hash = bcrypt.hashSync(String(password), 10);
        db.prepare(`
          UPDATE users SET username = ?, password_hash = ?, full_name = ?, is_active = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(String(username).trim(), hash, String(full_name).trim(), is_active === false || is_active === 0 ? 0 : 1, existing.user_id);
      } else {
        db.prepare(`
          UPDATE users SET username = ?, full_name = ?, is_active = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(String(username).trim(), String(full_name).trim(), is_active === false || is_active === 0 ? 0 : 1, existing.user_id);
      }
      db.prepare('UPDATE teachers SET nip = ?, phone = ?, email = ?, specialization = ? WHERE id = ?').run(
        String(nip || '').trim(),
        String(phone || '').trim(),
        String(email || '').trim(),
        String(specialization || '').trim(),
        id
      );
    });
    tx();
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'UPDATE_TEACHER',
      entityType: 'teacher',
      entityId: id,
      details: `Memperbarui data guru ${String(full_name).trim()}.`,
      ipAddress: getClientIp(req),
    });
    res.json({ message: 'Data guru berhasil diperbarui.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message?.includes('UNIQUE') ? 'Username guru sudah digunakan.' : 'Gagal memperbarui data guru.' });
  }
});

router.delete('/teachers/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT user_id FROM teachers WHERE id = ?').get(id) as { user_id: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Data guru tidak ditemukan.' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'DELETE_TEACHER',
    entityType: 'teacher',
    entityId: id,
    details: `Menghapus akun guru ID ${id}.`,
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Data guru berhasil dihapus.' });
});

// Students CRUD (Admin)
router.get('/students', requireAuth, requireRole('admin', 'guru'), (req, res) => {
  const db = getDb();
  const classId = req.query.class_id ? Number(req.query.class_id) : null;
  const departmentId = req.query.department_id ? Number(req.query.department_id) : null;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (classId) {
    where += ' AND s.class_id = ?';
    params.push(classId);
  }
  if (departmentId) {
    where += ' AND s.department_id = ?';
    params.push(departmentId);
  }

  const students = db.prepare(`
    SELECT s.id, s.user_id, u.username, u.full_name, u.is_active, u.last_login_at,
           s.nis, s.participant_number, s.class_id, s.department_id, s.gender, s.phone,
           c.name AS class_name, d.code AS department_code, d.name AS department_name
    FROM students s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN departments d ON d.id = s.department_id
    ${where}
    ORDER BY c.name ASC, u.full_name ASC
  `).all(...params);
  res.json({ students });
});

router.post('/students', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { username, password, full_name, nis, participant_number, class_id, department_id, gender, phone } = req.body || {};
  if (!username || !password || !full_name || !nis || !participant_number) {
    res.status(400).json({ error: 'Username, kata sandi, nama lengkap, NIS, dan nomor peserta wajib diisi.' });
    return;
  }
  const db = getDb();
  const hash = bcrypt.hashSync(String(password), 10);
  try {
    const tx = db.transaction(() => {
      const uRes = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(
        String(username).trim(),
        hash,
        String(full_name).trim(),
        'siswa'
      );
      const sRes = db.prepare(`
        INSERT INTO students (user_id, nis, participant_number, class_id, department_id, gender, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uRes.lastInsertRowid,
        String(nis).trim(),
        String(participant_number).trim(),
        class_id ? Number(class_id) : null,
        department_id ? Number(department_id) : null,
        gender === 'P' ? 'P' : 'L',
        String(phone || '').trim()
      );
      return Number(sRes.lastInsertRowid);
    });
    const studentId = tx();
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'CREATE_STUDENT',
      entityType: 'student',
      entityId: studentId,
      details: `Menambahkan siswa ${String(full_name).trim()} (NIS: ${String(nis).trim()}).`,
      ipAddress: getClientIp(req),
    });
    res.status(201).json({ id: studentId, message: 'Data siswa berhasil ditambahkan.' });
  } catch (err: any) {
    res.status(400).json({
      error: err.message?.includes('UNIQUE')
        ? 'Username, NIS, atau Nomor Peserta sudah terdaftar.'
        : 'Gagal menambahkan data siswa.',
    });
  }
});

router.put('/students/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { username, password, full_name, nis, participant_number, class_id, department_id, gender, phone, is_active } = req.body || {};
  if (!username || !full_name || !nis || !participant_number) {
    res.status(400).json({ error: 'Username, nama lengkap, NIS, dan nomor peserta wajib diisi.' });
    return;
  }
  const db = getDb();
  const existing = db.prepare('SELECT user_id FROM students WHERE id = ?').get(id) as { user_id: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
    return;
  }
  try {
    const tx = db.transaction(() => {
      if (password && String(password).trim().length >= 6) {
        const hash = bcrypt.hashSync(String(password), 10);
        db.prepare(`
          UPDATE users SET username = ?, password_hash = ?, full_name = ?, is_active = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(String(username).trim(), hash, String(full_name).trim(), is_active === false || is_active === 0 ? 0 : 1, existing.user_id);
      } else {
        db.prepare(`
          UPDATE users SET username = ?, full_name = ?, is_active = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(String(username).trim(), String(full_name).trim(), is_active === false || is_active === 0 ? 0 : 1, existing.user_id);
      }
      db.prepare(`
        UPDATE students SET nis = ?, participant_number = ?, class_id = ?, department_id = ?, gender = ?, phone = ?
        WHERE id = ?
      `).run(
        String(nis).trim(),
        String(participant_number).trim(),
        class_id ? Number(class_id) : null,
        department_id ? Number(department_id) : null,
        gender === 'P' ? 'P' : 'L',
        String(phone || '').trim(),
        id
      );
    });
    tx();
    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'UPDATE_STUDENT',
      entityType: 'student',
      entityId: id,
      details: `Memperbarui data siswa ${String(full_name).trim()} (NIS: ${String(nis).trim()}).`,
      ipAddress: getClientIp(req),
    });
    res.json({ message: 'Data siswa berhasil diperbarui.' });
  } catch (err: any) {
    res.status(400).json({
      error: err.message?.includes('UNIQUE')
        ? 'Username, NIS, atau Nomor Peserta sudah digunakan.'
        : 'Gagal memperbarui data siswa.',
    });
  }
});

router.delete('/students/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT user_id FROM students WHERE id = ?').get(id) as { user_id: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'DELETE_STUDENT',
    entityType: 'student',
    entityId: id,
    details: `Menghapus akun siswa ID ${id}.`,
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Data siswa berhasil dihapus.' });
});

// System Settings (Admin)
router.get('/settings', requireAuth, requireRole('admin'), (_req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM system_settings ORDER BY key ASC').all();
  res.json({ settings, lanIps: getLanIps() });
});

router.put('/settings', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { settings } = req.body || {};
  if (!Array.isArray(settings)) {
    res.status(400).json({ error: 'Format pengaturan tidak valid.' });
    return;
  }
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')
  `);
  const tx = db.transaction(() => {
    for (const item of settings) {
      if (item.key) {
        stmt.run(String(item.key), String(item.value ?? ''));
      }
    }
  });
  tx();
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'UPDATE_SETTINGS',
    entityType: 'system',
    details: 'Memperbarui konfigurasi sistem GHIFARI CBT.',
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Pengaturan sistem berhasil disimpan.' });
});

// Activity Logs (Admin)
router.get('/logs', requireAuth, requireRole('admin'), (req, res) => {
  const db = getDb();
  const role = req.query.role ? String(req.query.role) : '';
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : '';

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (role) {
    where += ' AND role = ?';
    params.push(role);
  }
  if (search) {
    where += ' AND (username LIKE ? OR action LIKE ? OR details LIKE ?)';
    params.push(search, search, search);
  }

  const logs = db.prepare(`
    SELECT * FROM activity_logs
    ${where}
    ORDER BY id DESC
    LIMIT 200
  `).all(...params);
  res.json({ logs });
});

// Backup & Restore Database (Admin)
router.get('/backup/info', requireAuth, requireRole('admin'), (_req, res) => {
  const stat = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
  const backupsDir = path.resolve(process.cwd(), 'backend', 'storage', 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const files = fs.readdirSync(backupsDir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const fStat = fs.statSync(path.join(backupsDir, f));
      return { name: f, sizeBytes: fStat.size, createdAt: fStat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({
    dbPath: DB_PATH,
    sizeBytes: stat ? stat.size : 0,
    lastModified: stat ? stat.mtime.toISOString() : null,
    localBackups: files,
  });
});

router.get('/backup/download', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDb();
    const backupsDir = path.resolve(process.cwd(), 'backend', 'storage', 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(backupsDir, `ghifari-cbt-backup-${stamp}.db`);
    await db.backup(backupFile);

    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'BACKUP_DATABASE',
      entityType: 'database',
      details: `Membuat dan mengunduh cadangan database ${path.basename(backupFile)}.`,
      ipAddress: getClientIp(req),
    });

    res.download(backupFile, `ghifari-cbt-backup-${stamp}.db`);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Gagal membuat cadangan database.' });
  }
});

router.post('/backup/restore', requireAuth, requireRole('admin'), uploadBackup.single('database'), (req: AuthenticatedRequest, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'File database (.db) wajib diunggah.' });
    return;
  }

  try {
    // Validate uploaded SQLite file
    const testDb = new Database(file.path, { readonly: true });
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    testDb.close();
    const tableNames = new Set(tables.map((t) => t.name));
    if (!tableNames.has('users') || !tableNames.has('exams') || !tableNames.has('questions')) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'File database tidak valid atau bukan cadangan GHIFARI CBT.' });
      return;
    }

    // Create safety backup before overwriting
    const backupsDir = path.resolve(process.cwd(), 'backend', 'storage', 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const preRestorePath = path.join(backupsDir, `pre-restore-${Date.now()}.db`);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, preRestorePath);
    }

    closeDb();
    // Remove WAL/SHM files if present
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(DB_PATH + suffix)) {
        fs.unlinkSync(DB_PATH + suffix);
      }
    }
    fs.copyFileSync(file.path, DB_PATH);
    fs.unlinkSync(file.path);

    initDatabase();

    logActivity({
      userId: req.user!.userId,
      username: req.user!.username,
      role: req.user!.role,
      action: 'RESTORE_DATABASE',
      entityType: 'database',
      details: 'Berhasil memulihkan database dari berkas cadangan.',
      ipAddress: getClientIp(req),
    });

    res.json({ message: 'Database berhasil dipulihkan. Silakan muat ulang halaman jika diperlukan.' });
  } catch (err) {
    console.error('Restore error:', err);
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    initDatabase();
    res.status(500).json({ error: 'Gagal memulihkan database. Pastikan file berformat SQLite (.db) yang sah.' });
  }
});

export default router;
