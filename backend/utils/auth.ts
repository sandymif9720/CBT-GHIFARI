import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getDb } from '../database/db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'ghifari-cbt-smk-al-ghifari-local-lan-secret-2026';

export interface AuthPayload {
  userId: number;
  username: string;
  fullName: string;
  role: 'admin' | 'guru' | 'siswa';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.ghifari_token) {
    token = req.cookies.ghifari_token;
  }

  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login terlebih dahulu.' });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Sesi telah berakhir atau tidak valid. Silakan login ulang.' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, full_name, role, is_active FROM users WHERE id = ?').get(decoded.userId) as
    | { id: number; username: string; full_name: string; role: 'admin' | 'guru' | 'siswa'; is_active: number }
    | undefined;

  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Akun tidak aktif atau tidak ditemukan.' });
    return;
  }

  req.user = {
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
  };
  next();
}

export function requireRole(...roles: Array<'admin' | 'guru' | 'siswa'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk fitur ini.' });
      return;
    }
    next();
  };
}

export const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // generous for 30-50 LAN students behind NAT if needed, still prevents brute force
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Silakan tunggu beberapa menit.' },
});

export function logActivity(params: {
  userId?: number | null;
  username?: string;
  role?: string;
  action: string;
  entityType?: string;
  entityId?: string | number;
  details: string;
  ipAddress?: string;
}): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO activity_logs (user_id, username, role, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId ?? null,
      params.username ?? 'system',
      params.role ?? 'system',
      params.action,
      params.entityType ?? '',
      params.entityId !== undefined ? String(params.entityId) : '',
      params.details,
      params.ipAddress ?? '127.0.0.1'
    );
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}
