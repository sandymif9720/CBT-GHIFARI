import { Router } from 'express';
import bcrypt from 'bcryptjs';
import os from 'os';
import { getDb } from '../database/db.ts';
import {
  type AuthenticatedRequest,
  getClientIp,
  logActivity,
  loginRateLimiter,
  requireAuth,
  signToken,
} from '../utils/auth.ts';

const router = Router();

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

function buildUserProfile(userId: number) {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, username, full_name, role, is_active, last_login_at
    FROM users WHERE id = ?
  `).get(userId) as {
    id: number;
    username: string;
    full_name: string;
    role: 'admin' | 'guru' | 'siswa';
    is_active: number;
    last_login_at: string | null;
  } | undefined;

  if (!user) return null;

  let teacher = null;
  let student = null;

  if (user.role === 'guru') {
    teacher = db.prepare(`SELECT id, nip, phone, email, specialization FROM teachers WHERE user_id = ?`).get(user.id) || null;
  } else if (user.role === 'siswa') {
    student = db.prepare(`
      SELECT s.id, s.nis, s.participant_number, s.class_id, s.department_id, s.gender, s.phone,
             c.name AS class_name, c.grade_level, d.code AS department_code, d.name AS department_name
      FROM students s
      LEFT JOIN classes c ON c.id = s.class_id
      LEFT JOIN departments d ON d.id = s.department_id
      WHERE s.user_id = ?
    `).get(user.id) || null;
  }

  const school = db.prepare('SELECT id, name, npsn, address, phone, email, principal_name, academic_year, semester FROM schools LIMIT 1').get();

  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    lastLoginAt: user.last_login_at,
    teacher,
    student,
    school,
    lanIps: getLanIps(),
  };
}

router.post('/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    res.status(400).json({ error: 'Username dan kata sandi wajib diisi.' });
    return;
  }

  const cleanUsername = username.trim();
  const db = getDb();
  const ip = getClientIp(req);

  const user = db.prepare(`
    SELECT id, username, password_hash, full_name, role, is_active
    FROM users WHERE username = ?
  `).get(cleanUsername) as {
    id: number;
    username: string;
    password_hash: string;
    full_name: string;
    role: 'admin' | 'guru' | 'siswa';
    is_active: number;
  } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logActivity({
      username: cleanUsername,
      role: user?.role || 'unknown',
      action: 'LOGIN_FAILED',
      entityType: 'auth',
      details: `Percobaan login gagal untuk username "${cleanUsername}".`,
      ipAddress: ip,
    });
    res.status(401).json({ error: 'Username atau kata sandi salah.' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi Administrator Sekolah.' });
    return;
  }

  db.prepare(`UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?`).run(user.id);

  const token = signToken({
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
  });

  logActivity({
    userId: user.id,
    username: user.username,
    role: user.role,
    action: 'LOGIN_SUCCESS',
    entityType: 'auth',
    entityId: user.id,
    details: `${user.full_name} (${user.role}) berhasil login ke GHIFARI CBT.`,
    ipAddress: ip,
  });

  res.cookie('ghifari_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });

  const profile = buildUserProfile(user.id);
  res.json({ token, user: profile });
});

router.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  if (req.user) {
    logActivity({
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role,
      action: 'LOGOUT',
      entityType: 'auth',
      entityId: req.user.userId,
      details: `${req.user.fullName} keluar dari sistem.`,
      ipAddress: getClientIp(req),
    });
  }
  res.clearCookie('ghifari_token');
  res.json({ message: 'Berhasil keluar dari sistem.' });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Tidak terautentikasi.' });
    return;
  }
  const profile = buildUserProfile(req.user.userId);
  if (!profile) {
    res.status(404).json({ error: 'Profil pengguna tidak ditemukan.' });
    return;
  }
  res.json({ user: profile });
});

router.post('/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
    return;
  }
  const db = getDb();
  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user!.userId) as
    | { id: number; password_hash: string }
    | undefined;

  if (!user || !bcrypt.compareSync(String(currentPassword), user.password_hash)) {
    res.status(400).json({ error: 'Kata sandi saat ini tidak sesuai.' });
    return;
  }

  const newHash = bcrypt.hashSync(String(newPassword), 10);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`).run(
    newHash,
    req.user!.userId
  );

  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'CHANGE_PASSWORD',
    entityType: 'user',
    entityId: req.user!.userId,
    details: 'Pengguna mengubah kata sandi akun.',
    ipAddress: getClientIp(req),
  });

  res.json({ message: 'Kata sandi berhasil diperbarui.' });
});

router.get('/public-info', (_req, res) => {
  const db = getDb();
  const school = db.prepare('SELECT name, npsn, address, academic_year, semester FROM schools LIMIT 1').get();
  res.json({
    appName: 'GHIFARI CBT',
    tagline: 'Smarter Examination. Better Education.',
    institution: 'SMK AL-GHIFARI',
    developerCredit: 'MARGUMI STUDIO',
    school,
    lanIps: getLanIps(),
    serverTime: new Date().toISOString(),
  });
});

export default router;
