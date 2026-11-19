import { Router } from 'express';
import ExcelJS from 'exceljs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getDb } from '../database/db.ts';
import { type AuthenticatedRequest, getClientIp, logActivity, requireAuth, requireRole } from '../utils/auth.ts';

const router = Router();
const uploadExcel = multer({
  dest: path.resolve(process.cwd(), 'backend', 'uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const TEMPLATE_COLUMNS = [
  'kode_soal',
  'mapel',
  'kelas',
  'jurusan',
  'materi',
  'jenis_soal',
  'pertanyaan',
  'opsi_a',
  'opsi_b',
  'opsi_c',
  'opsi_d',
  'opsi_e',
  'kunci_jawaban',
  'skor',
];

function getCellText(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'object') {
    if ('richText' in cellValue && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((r: any) => r.text || '').join('').trim();
    }
    if ('text' in cellValue) return String(cellValue.text || '').trim();
    if ('result' in cellValue) return String(cellValue.result ?? '').trim();
  }
  return String(cellValue).trim();
}

// Download Excel Template (sheet name: SOAL)
router.get('/template', requireAuth, requireRole('admin', 'guru'), async (_req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GHIFARI CBT - MARGUMI STUDIO';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('SOAL');
    sheet.columns = [
      { header: 'kode_soal', key: 'kode_soal', width: 16 },
      { header: 'mapel', key: 'mapel', width: 28 },
      { header: 'kelas', key: 'kelas', width: 10 },
      { header: 'jurusan', key: 'jurusan', width: 12 },
      { header: 'materi', key: 'materi', width: 24 },
      { header: 'jenis_soal', key: 'jenis_soal', width: 12 },
      { header: 'pertanyaan', key: 'pertanyaan', width: 48 },
      { header: 'opsi_a', key: 'opsi_a', width: 28 },
      { header: 'opsi_b', key: 'opsi_b', width: 28 },
      { header: 'opsi_c', key: 'opsi_c', width: 28 },
      { header: 'opsi_d', key: 'opsi_d', width: 28 },
      { header: 'opsi_e', key: 'opsi_e', width: 28 },
      { header: 'kunci_jawaban', key: 'kunci_jawaban', width: 15 },
      { header: 'skor', key: 'skor', width: 10 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102B50' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    sheet.addRow({
      kode_soal: 'INF-CTH-001',
      mapel: 'Sistem Operasi & Jaringan',
      kelas: 'XI',
      jurusan: 'TKJ',
      materi: 'Sistem Operasi',
      jenis_soal: 'PG',
      pertanyaan: 'Apa fungsi sistem operasi?',
      opsi_a: 'Mengelola perangkat keras dan perangkat lunak',
      opsi_b: 'Membuat desain grafis',
      opsi_c: 'Mengedit video',
      opsi_d: 'Mengolah gambar saja',
      opsi_e: 'Membuat jaringan internet',
      kunci_jawaban: 'A',
      skor: 10,
    });

    sheet.addRow({
      kode_soal: 'INF-CTH-002',
      mapel: 'Sistem Operasi & Jaringan',
      kelas: 'XI',
      jurusan: 'TKJ',
      materi: 'Sistem Operasi',
      jenis_soal: 'ESAI',
      pertanyaan: 'Jelaskan fungsi sistem operasi pada komputer.',
      opsi_a: '',
      opsi_b: '',
      opsi_c: '',
      opsi_d: '',
      opsi_e: '',
      kunci_jawaban: '',
      skor: 20,
    });

    const guideSheet = workbook.addWorksheet('PETUNJUK');
    guideSheet.addRow(['PETUNJUK PENGISIAN TEMPLATE SOAL — GHIFARI CBT (SMK AL-GHIFARI)']);
    guideSheet.addRow(['1. Jangan mengubah nama sheet "SOAL" dan nama kolom pada baris pertama.']);
    guideSheet.addRow(['2. jenis_soal harus diisi "PG" (Pilihan Ganda A-E) atau "ESAI".']);
    guideSheet.addRow(['3. Untuk soal PG, opsi_a s.d opsi_e tidak boleh kosong dan kunci_jawaban wajib A, B, C, D, atau E.']);
    guideSheet.addRow(['4. Untuk soal ESAI, kosongkan opsi_a..e dan kunci_jawaban karena dinilai manual oleh guru.']);
    guideSheet.addRow(['5. skor wajib berupa angka positif lebih dari 0.']);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-soal-ghifari-cbt.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Template error:', err);
    res.status(500).json({ error: 'Gagal membuat template Excel.' });
  }
});

// List Question Banks
router.get('/banks', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
  const departmentId = req.query.department_id ? Number(req.query.department_id) : null;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (req.user!.role === 'guru') {
    where += ' AND qb.created_by = ?';
    params.push(req.user!.userId);
  }
  if (subjectId) {
    where += ' AND qb.subject_id = ?';
    params.push(subjectId);
  }
  if (departmentId) {
    where += ' AND qb.department_id = ?';
    params.push(departmentId);
  }

  const banks = db.prepare(`
    SELECT qb.*, s.name AS subject_name, s.code AS subject_code,
           d.code AS department_code, d.name AS department_name,
           u.full_name AS creator_name,
           (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id) AS total_questions,
           (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id AND q.question_type = 'PG') AS pg_count,
           (SELECT COUNT(*) FROM questions q WHERE q.bank_id = qb.id AND q.question_type = 'ESAI') AS essay_count
    FROM question_banks qb
    JOIN subjects s ON s.id = qb.subject_id
    LEFT JOIN departments d ON d.id = qb.department_id
    JOIN users u ON u.id = qb.created_by
    ${where}
    ORDER BY qb.updated_at DESC, qb.id DESC
  `).all(...params);

  res.json({ banks });
});

router.post('/banks', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { title, subject_id, class_level, department_id, topic } = req.body || {};
  if (!title || !subject_id) {
    res.status(400).json({ error: 'Judul bank soal dan mata pelajaran wajib diisi.' });
    return;
  }
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO question_banks (title, subject_id, class_level, department_id, topic, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    String(title).trim(),
    Number(subject_id),
    String(class_level || 'XI').trim(),
    department_id ? Number(department_id) : null,
    String(topic || '').trim(),
    req.user!.userId
  );
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'CREATE_BANK',
    entityType: 'question_bank',
    entityId: Number(result.lastInsertRowid),
    details: `Membuat bank soal "${String(title).trim()}".`,
    ipAddress: getClientIp(req),
  });
  res.status(201).json({ id: result.lastInsertRowid, message: 'Bank soal berhasil dibuat.' });
});

router.put('/banks/:id', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { title, subject_id, class_level, department_id, topic } = req.body || {};
  if (!title || !subject_id) {
    res.status(400).json({ error: 'Judul bank soal dan mata pelajaran wajib diisi.' });
    return;
  }
  const db = getDb();
  const bank = db.prepare('SELECT created_by FROM question_banks WHERE id = ?').get(id) as { created_by: number } | undefined;
  if (!bank) {
    res.status(404).json({ error: 'Bank soal tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && bank.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda hanya dapat mengubah bank soal milik Anda.' });
    return;
  }
  db.prepare(`
    UPDATE question_banks
    SET title = ?, subject_id = ?, class_level = ?, department_id = ?, topic = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    String(title).trim(),
    Number(subject_id),
    String(class_level || 'XI').trim(),
    department_id ? Number(department_id) : null,
    String(topic || '').trim(),
    id
  );
  res.json({ message: 'Bank soal berhasil diperbarui.' });
});

router.delete('/banks/:id', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  const bank = db.prepare('SELECT created_by, title FROM question_banks WHERE id = ?').get(id) as
    | { created_by: number; title: string }
    | undefined;
  if (!bank) {
    res.status(404).json({ error: 'Bank soal tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && bank.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda tidak berhak menghapus bank soal ini.' });
    return;
  }
  db.prepare('DELETE FROM question_banks WHERE id = ?').run(id);
  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'DELETE_BANK',
    entityType: 'question_bank',
    entityId: id,
    details: `Menghapus bank soal "${bank.title}".`,
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Bank soal berhasil dihapus.' });
});

// List Questions
router.get('/', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const bankId = req.query.bank_id ? Number(req.query.bank_id) : null;
  const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
  const classLevel = req.query.class_level ? String(req.query.class_level).trim() : '';
  const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
  const topic = req.query.topic ? String(req.query.topic).trim() : '';
  const questionType = req.query.question_type ? String(req.query.question_type).trim() : '';
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : '';

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (req.user!.role === 'guru') {
    where += ' AND q.created_by = ?';
    params.push(req.user!.userId);
  }
  if (bankId) {
    where += ' AND q.bank_id = ?';
    params.push(bankId);
  }
  if (subjectId) {
    where += ' AND q.subject_id = ?';
    params.push(subjectId);
  }
  if (classLevel) {
    where += ' AND q.class_level = ?';
    params.push(classLevel);
  }
  if (departmentId) {
    where += ' AND q.department_id = ?';
    params.push(departmentId);
  }
  if (topic) {
    where += ' AND q.topic LIKE ?';
    params.push(`%${topic}%`);
  }
  if (questionType) {
    where += ' AND q.question_type = ?';
    params.push(questionType);
  }
  if (search) {
    where += ' AND (q.question_text LIKE ? OR q.question_code LIKE ? OR q.topic LIKE ?)';
    params.push(search, search, search);
  }

  const questions = db.prepare(`
    SELECT q.*, qb.title AS bank_title, s.name AS subject_name, d.code AS department_code
    FROM questions q
    JOIN question_banks qb ON qb.id = q.bank_id
    JOIN subjects s ON s.id = q.subject_id
    LEFT JOIN departments d ON d.id = q.department_id
    ${where}
    ORDER BY q.id DESC
  `).all(...params);

  res.json({ questions });
});

// Create Single Question
router.post('/', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const {
    bank_id, question_code, subject_id, class_level, department_id, topic,
    question_type, question_text, option_a, option_b, option_c, option_d, option_e,
    correct_answer, score,
  } = req.body || {};

  if (!bank_id || !question_text || !String(question_text).trim()) {
    res.status(400).json({ error: 'Bank soal dan teks pertanyaan wajib diisi.' });
    return;
  }

  const qType = question_type === 'ESAI' ? 'ESAI' : 'PG';
  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore <= 0) {
    res.status(400).json({ error: 'Skor soal harus berupa angka positif.' });
    return;
  }

  if (qType === 'PG') {
    if (!option_a?.trim() || !option_b?.trim() || !option_c?.trim() || !option_d?.trim() || !option_e?.trim()) {
      res.status(400).json({ error: 'Untuk soal Pilihan Ganda, seluruh opsi A sampai E wajib diisi.' });
      return;
    }
    const key = String(correct_answer || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D', 'E'].includes(key)) {
      res.status(400).json({ error: 'Kunci jawaban Pilihan Ganda harus A, B, C, D, atau E.' });
      return;
    }
  }

  const db = getDb();
  const bank = db.prepare('SELECT id, subject_id, class_level, department_id, topic, created_by FROM question_banks WHERE id = ?').get(Number(bank_id)) as any;
  if (!bank) {
    res.status(404).json({ error: 'Bank soal tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && bank.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda tidak dapat menambah soal pada bank soal guru lain.' });
    return;
  }

  const code = String(question_code || '').trim() || `SOAL-${Date.now().toString().slice(-6)}`;
  const result = db.prepare(`
    INSERT INTO questions (
      bank_id, question_code, subject_id, class_level, department_id, topic,
      question_type, question_text, option_a, option_b, option_c, option_d, option_e,
      correct_answer, score, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(bank_id),
    code,
    subject_id ? Number(subject_id) : bank.subject_id,
    String(class_level || bank.class_level || 'XI').trim(),
    department_id !== undefined ? (department_id ? Number(department_id) : null) : bank.department_id,
    String(topic ?? bank.topic ?? '').trim(),
    qType,
    String(question_text).trim(),
    qType === 'PG' ? String(option_a).trim() : '',
    qType === 'PG' ? String(option_b).trim() : '',
    qType === 'PG' ? String(option_c).trim() : '',
    qType === 'PG' ? String(option_d).trim() : '',
    qType === 'PG' ? String(option_e).trim() : '',
    qType === 'PG' ? String(correct_answer).trim().toUpperCase() : '',
    numScore,
    req.user!.userId
  );

  db.prepare(`UPDATE question_banks SET updated_at = datetime('now', 'localtime') WHERE id = ?`).run(Number(bank_id));

  res.status(201).json({ id: result.lastInsertRowid, message: 'Soal berhasil ditambahkan.' });
});

// Update Single Question
router.put('/:id', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const {
    question_code, subject_id, class_level, department_id, topic,
    question_type, question_text, option_a, option_b, option_c, option_d, option_e,
    correct_answer, score,
  } = req.body || {};

  const db = getDb();
  const existing = db.prepare('SELECT created_by, bank_id FROM questions WHERE id = ?').get(id) as
    | { created_by: number; bank_id: number }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Soal tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && existing.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda tidak berhak mengubah soal ini.' });
    return;
  }

  if (!question_text || !String(question_text).trim()) {
    res.status(400).json({ error: 'Teks pertanyaan wajib diisi.' });
    return;
  }
  const qType = question_type === 'ESAI' ? 'ESAI' : 'PG';
  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore <= 0) {
    res.status(400).json({ error: 'Skor harus berupa angka positif.' });
    return;
  }
  if (qType === 'PG') {
    if (!option_a?.trim() || !option_b?.trim() || !option_c?.trim() || !option_d?.trim() || !option_e?.trim()) {
      res.status(400).json({ error: 'Semua opsi A-E wajib diisi untuk soal Pilihan Ganda.' });
      return;
    }
    const key = String(correct_answer || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D', 'E'].includes(key)) {
      res.status(400).json({ error: 'Kunci jawaban Pilihan Ganda harus A, B, C, D, atau E.' });
      return;
    }
  }

  db.prepare(`
    UPDATE questions SET
      question_code = ?, subject_id = COALESCE(?, subject_id), class_level = ?, department_id = ?, topic = ?,
      question_type = ?, question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, option_e = ?,
      correct_answer = ?, score = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    String(question_code || '').trim(),
    subject_id ? Number(subject_id) : null,
    String(class_level || 'XI').trim(),
    department_id ? Number(department_id) : null,
    String(topic || '').trim(),
    qType,
    String(question_text).trim(),
    qType === 'PG' ? String(option_a).trim() : '',
    qType === 'PG' ? String(option_b).trim() : '',
    qType === 'PG' ? String(option_c).trim() : '',
    qType === 'PG' ? String(option_d).trim() : '',
    qType === 'PG' ? String(option_e).trim() : '',
    qType === 'PG' ? String(correct_answer).trim().toUpperCase() : '',
    numScore,
    id
  );

  db.prepare(`UPDATE question_banks SET updated_at = datetime('now', 'localtime') WHERE id = ?`).run(existing.bank_id);
  res.json({ message: 'Soal berhasil diperbarui.' });
});

router.delete('/:id', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  const existing = db.prepare('SELECT created_by FROM questions WHERE id = ?').get(id) as { created_by: number } | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Soal tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && existing.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda tidak berhak menghapus soal ini.' });
    return;
  }
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  res.json({ message: 'Soal berhasil dihapus.' });
});

// Excel Import Preview & Validation
router.post('/import/preview', requireAuth, requireRole('admin', 'guru'), uploadExcel.single('file'), async (req: AuthenticatedRequest, res) => {
  const file = req.file;
  const bankId = req.body?.bank_id ? Number(req.body.bank_id) : null;

  if (!file) {
    res.status(400).json({ error: 'File Excel (.xlsx) wajib dipilih.' });
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    fs.unlinkSync(file.path);

    const sheet = workbook.getWorksheet('SOAL') || workbook.worksheets[0];
    if (!sheet) {
      res.status(400).json({ error: 'Sheet "SOAL" tidak ditemukan dalam file Excel.' });
      return;
    }

    const headerRow = sheet.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const h = getCellText(cell.value).toLowerCase();
      if (h) headers[h] = colNumber;
    });

    const missingCols = TEMPLATE_COLUMNS.filter((c) => !headers[c]);
    if (missingCols.length > 0) {
      res.status(400).json({
        error: `Format kolom Excel tidak sesuai template. Kolom yang tidak ditemukan: ${missingCols.join(', ')}`,
      });
      return;
    }

    const db = getDb();
    const existingCodes = new Set(
      (db.prepare('SELECT question_code FROM questions').all() as Array<{ question_code: string }>).map((r) =>
        r.question_code.toLowerCase()
      )
    );
    const existingTexts = new Set(
      (db.prepare('SELECT question_text FROM questions').all() as Array<{ question_text: string }>).map((r) =>
        r.question_text.trim().toLowerCase()
      )
    );

    const seenInFile = new Set<string>();
    const rows: any[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const getVal = (colName: string) => getCellText(row.getCell(headers[colName]).value);

      const kode_soal = getVal('kode_soal') || `IMP-${rowNumber}`;
      const mapel = getVal('mapel');
      const kelas = getVal('kelas') || 'XI';
      const jurusan = getVal('jurusan');
      const materi = getVal('materi');
      const jenis_soal = getVal('jenis_soal').toUpperCase();
      const pertanyaan = getVal('pertanyaan');
      const opsi_a = getVal('opsi_a');
      const opsi_b = getVal('opsi_b');
      const opsi_c = getVal('opsi_c');
      const opsi_d = getVal('opsi_d');
      const opsi_e = getVal('opsi_e');
      const kunci_jawaban = getVal('kunci_jawaban').toUpperCase();
      const skorRaw = getVal('skor');
      const skor = Number(skorRaw);

      // Skip completely empty trailing rows
      if (!pertanyaan && !opsi_a && !kode_soal.startsWith('IMP-') && !mapel) return;
      if (!pertanyaan && !opsi_a && !mapel && !jenis_soal) return;

      const errors: string[] = [];
      if (!pertanyaan) {
        errors.push('Pertanyaan wajib diisi');
      }
      if (!['PG', 'ESAI'].includes(jenis_soal)) {
        errors.push('jenis_soal harus "PG" atau "ESAI"');
      }
      if (jenis_soal === 'PG') {
        if (!opsi_a || !opsi_b || !opsi_c || !opsi_d || !opsi_e) {
          errors.push('Pilihan jawaban A–E tidak boleh ada yang kosong');
        }
        if (!['A', 'B', 'C', 'D', 'E'].includes(kunci_jawaban)) {
          errors.push('Kunci jawaban PG harus A, B, C, D, atau E');
        }
      }
      if (!Number.isFinite(skor) || skor <= 0) {
        errors.push('Skor harus berupa angka positif (> 0)');
      }

      const isDuplicate =
        existingCodes.has(kode_soal.toLowerCase()) ||
        (pertanyaan ? existingTexts.has(pertanyaan.toLowerCase()) : false) ||
        (pertanyaan ? seenInFile.has(pertanyaan.toLowerCase()) : false);

      if (pertanyaan) {
        seenInFile.add(pertanyaan.toLowerCase());
      }

      rows.push({
        rowNumber,
        kode_soal,
        mapel,
        kelas,
        jurusan,
        materi,
        jenis_soal,
        pertanyaan,
        opsi_a,
        opsi_b,
        opsi_c,
        opsi_d,
        opsi_e,
        kunci_jawaban,
        skor: Number.isFinite(skor) ? skor : 0,
        errors,
        isDuplicate,
        isValid: errors.length === 0,
      });
    });

    const validCount = rows.filter((r) => r.isValid).length;
    const errorCount = rows.filter((r) => !r.isValid).length;
    const duplicateCount = rows.filter((r) => r.isValid && r.isDuplicate).length;

    res.json({
      bankId,
      sheetName: sheet.name,
      summary: {
        totalRows: rows.length,
        validCount,
        errorCount,
        duplicateCount,
      },
      rows,
    });
  } catch (err) {
    console.error('Excel preview error:', err);
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(400).json({ error: 'Gagal membaca file Excel. Pastikan format file adalah .xlsx yang valid.' });
  }
});

// Excel Import Confirm
router.post('/import/confirm', requireAuth, requireRole('admin', 'guru'), (req: AuthenticatedRequest, res) => {
  const { bank_id, rows, allow_duplicates } = req.body || {};
  if (!bank_id || !Array.isArray(rows)) {
    res.status(400).json({ error: 'Data bank soal dan baris soal tidak lengkap.' });
    return;
  }

  const db = getDb();
  const bank = db.prepare('SELECT id, subject_id, class_level, department_id, created_by FROM question_banks WHERE id = ?').get(Number(bank_id)) as any;
  if (!bank) {
    res.status(404).json({ error: 'Bank soal tujuan tidak ditemukan.' });
    return;
  }
  if (req.user!.role === 'guru' && bank.created_by !== req.user!.userId) {
    res.status(403).json({ error: 'Anda tidak berhak mengimpor ke bank soal ini.' });
    return;
  }

  const departments = db.prepare('SELECT id, code, name FROM departments').all() as Array<{ id: number; code: string; name: string }>;
  const subjects = db.prepare('SELECT id, code, name FROM subjects').all() as Array<{ id: number; code: string; name: string }>;

  const findDeptId = (val: string) => {
    if (!val) return bank.department_id;
    const lower = val.toLowerCase();
    const match = departments.find((d) => d.code.toLowerCase() === lower || d.name.toLowerCase() === lower);
    return match ? match.id : bank.department_id;
  };
  const findSubjId = (val: string) => {
    if (!val) return bank.subject_id;
    const lower = val.toLowerCase();
    const match = subjects.find((s) => s.code.toLowerCase() === lower || s.name.toLowerCase().includes(lower));
    return match ? match.id : bank.subject_id;
  };

  let importedCount = 0;
  let skippedDuplicates = 0;
  let failedCount = 0;
  const failedRows: Array<{ rowNumber: number; reason: string }> = [];

  const insertStmt = db.prepare(`
    INSERT INTO questions (
      bank_id, question_code, subject_id, class_level, department_id, topic,
      question_type, question_text, option_a, option_b, option_c, option_d, option_e,
      correct_answer, score, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const r of rows) {
      if (!r.isValid) {
        failedCount++;
        failedRows.push({ rowNumber: r.rowNumber, reason: (r.errors || []).join('; ') });
        continue;
      }
      if (r.isDuplicate && !allow_duplicates) {
        skippedDuplicates++;
        continue;
      }
      insertStmt.run(
        bank.id,
        String(r.kode_soal || `IMP-${Date.now()}-${importedCount}`).trim(),
        findSubjId(r.mapel || ''),
        String(r.kelas || bank.class_level || 'XI').trim(),
        findDeptId(r.jurusan || ''),
        String(r.materi || '').trim(),
        r.jenis_soal === 'ESAI' ? 'ESAI' : 'PG',
        String(r.pertanyaan).trim(),
        r.jenis_soal === 'PG' ? String(r.opsi_a).trim() : '',
        r.jenis_soal === 'PG' ? String(r.opsi_b).trim() : '',
        r.jenis_soal === 'PG' ? String(r.opsi_c).trim() : '',
        r.jenis_soal === 'PG' ? String(r.opsi_d).trim() : '',
        r.jenis_soal === 'PG' ? String(r.opsi_e).trim() : '',
        r.jenis_soal === 'PG' ? String(r.kunci_jawaban).trim().toUpperCase() : '',
        Number(r.skor) > 0 ? Number(r.skor) : 10,
        req.user!.userId
      );
      importedCount++;
    }
    db.prepare(`UPDATE question_banks SET updated_at = datetime('now', 'localtime') WHERE id = ?`).run(bank.id);
  });

  tx();

  logActivity({
    userId: req.user!.userId,
    username: req.user!.username,
    role: req.user!.role,
    action: 'IMPORT_EXCEL_QUESTIONS',
    entityType: 'question_bank',
    entityId: bank.id,
    details: `Impor Excel soal ke bank ID ${bank.id}: ${importedCount} berhasil, ${skippedDuplicates} duplikat dilewati, ${failedCount} gagal.`,
    ipAddress: getClientIp(req),
  });

  res.json({
    importedCount,
    skippedDuplicates,
    failedCount,
    failedRows,
    message: `Berhasil mengimpor ${importedCount} soal ke bank soal.`,
  });
});

export default router;
