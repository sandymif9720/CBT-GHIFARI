import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { initDatabase } from './backend/database/db.ts';
import authRoutes from './backend/routes/authRoutes.ts';
import adminRoutes from './backend/routes/adminRoutes.ts';
import questionRoutes from './backend/routes/questionRoutes.ts';
import examRoutes from './backend/routes/examRoutes.ts';
import studentRoutes from './backend/routes/studentRoutes.ts';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

initDatabase();

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Basic CORS headers for local LAN access if accessed across ports
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'GHIFARI CBT', serverTime: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/student', studentRoutes);

// API 404 handler
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
});

async function startServer() {
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    const interfaces = os.networkInterfaces();
    const lanIps: string[] = [];
    for (const list of Object.values(interfaces)) {
      if (!list) continue;
      for (const iface of list) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIps.push(iface.address);
        }
      }
    }
    console.log(`\n==================================================`);
    console.log(`  GHIFARI CBT — SMK AL-GHIFARI`);
    console.log(`  Smarter Examination. Better Education.`);
    console.log(`  Developed by MARGUMI STUDIO`);
    console.log(`==================================================`);
    console.log(`  Server berjalan pada port ${PORT}`);
    console.log(`  Akses Lokal : http://localhost:${PORT}`);
    for (const ip of lanIps) {
      console.log(`  Akses LAN   : http://${ip}:${PORT}`);
    }
    console.log(`==================================================\n`);
  });
}

startServer();
