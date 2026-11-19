import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.resolve(process.cwd(), 'backend', 'storage');
const UPLOADS_DIR = path.resolve(process.cwd(), 'backend', 'uploads');
const BACKUPS_DIR = path.resolve(process.cwd(), 'backend', 'storage', 'backups');
export const DB_PATH = path.join(STORAGE_DIR, 'ghifari_cbt.db');

fs.mkdirSync(STORAGE_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('busy_timeout = 5000');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function getLocalDateString(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function initDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      npsn TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      principal_name TEXT NOT NULL DEFAULT '',
      academic_year TEXT NOT NULL DEFAULT '2026/2027',
      semester TEXT NOT NULL DEFAULT 'Ganjil',
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'siswa')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      grade_level TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      academic_year TEXT NOT NULL DEFAULT '2026/2027',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      nip TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      specialization TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      nis TEXT NOT NULL UNIQUE,
      participant_number TEXT NOT NULL UNIQUE,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      gender TEXT NOT NULL DEFAULT 'L' CHECK (gender IN ('L', 'P')),
      phone TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS question_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_level TEXT NOT NULL DEFAULT 'XI',
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      topic TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id INTEGER NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
      question_code TEXT NOT NULL,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_level TEXT NOT NULL DEFAULT 'XI',
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      topic TEXT NOT NULL DEFAULT '',
      question_type TEXT NOT NULL CHECK (question_type IN ('PG', 'ESAI')),
      question_text TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      option_a TEXT NOT NULL DEFAULT '',
      option_b TEXT NOT NULL DEFAULT '',
      option_c TEXT NOT NULL DEFAULT '',
      option_d TEXT NOT NULL DEFAULT '',
      option_e TEXT NOT NULL DEFAULT '',
      correct_answer TEXT NOT NULL DEFAULT '',
      score REAL NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      bank_id INTEGER REFERENCES question_banks(id) ON DELETE SET NULL,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exam_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      question_count INTEGER NOT NULL DEFAULT 10,
      pg_weight REAL NOT NULL DEFAULT 70,
      essay_weight REAL NOT NULL DEFAULT 30,
      passing_grade REAL NOT NULL DEFAULT 75,
      shuffle_questions INTEGER NOT NULL DEFAULT 1,
      shuffle_options INTEGER NOT NULL DEFAULT 1,
      show_result INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Terjadwal', 'Berlangsung', 'Selesai', 'Dibatalkan')),
      instructions TEXT NOT NULL DEFAULT 'Bacalah setiap soal dengan teliti sebelum memilih atau menuliskan jawaban.',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS exam_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      UNIQUE(exam_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS exam_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'belum_mulai' CHECK (status IN ('belum_mulai', 'sedang_mengerjakan', 'terputus', 'selesai', 'waktu_habis')),
      session_token TEXT NOT NULL DEFAULT '',
      question_order_json TEXT NOT NULL DEFAULT '[]',
      option_orders_json TEXT NOT NULL DEFAULT '{}',
      started_at TEXT,
      expires_at TEXT,
      submitted_at TEXT,
      last_seen_at TEXT,
      ip_address TEXT NOT NULL DEFAULT '',
      UNIQUE(exam_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL REFERENCES exam_participants(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      answer_text TEXT NOT NULL DEFAULT '',
      is_doubtful INTEGER NOT NULL DEFAULT 0,
      is_correct INTEGER,
      earned_score REAL NOT NULL DEFAULT 0,
      answered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(participant_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS essay_grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      answer_id INTEGER NOT NULL UNIQUE REFERENCES answers(id) ON DELETE CASCADE,
      participant_id INTEGER NOT NULL REFERENCES exam_participants(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      score REAL NOT NULL DEFAULT 0,
      max_score REAL NOT NULL DEFAULT 10,
      feedback TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'belum_dinilai' CHECK (status IN ('belum_dinilai', 'sudah_dinilai')),
      graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      graded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      participant_id INTEGER NOT NULL UNIQUE REFERENCES exam_participants(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      pg_correct INTEGER NOT NULL DEFAULT 0,
      pg_total INTEGER NOT NULL DEFAULT 0,
      pg_score REAL NOT NULL DEFAULT 0,
      essay_score REAL NOT NULL DEFAULT 0,
      essay_graded INTEGER NOT NULL DEFAULT 1,
      final_score REAL,
      passed INTEGER,
      calculated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT NOT NULL DEFAULT 'system',
      role TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT '',
      entity_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_questions_bank ON questions(bank_id);
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
    CREATE INDEX IF NOT EXISTS idx_questions_code ON questions(question_code);
    CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
    CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
    CREATE INDEX IF NOT EXISTS idx_exam_participants_exam ON exam_participants(exam_id);
    CREATE INDEX IF NOT EXISTS idx_exam_participants_student ON exam_participants(student_id);
    CREATE INDEX IF NOT EXISTS idx_answers_participant ON answers(participant_id);
    CREATE INDEX IF NOT EXISTS idx_essay_grades_participant ON essay_grades(participant_id);
    CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
  `);

  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  if (userCount.cnt === 0) {
    seedDemoData(db);
  }
}

function seedDemoData(db: Database.Database): void {
  const adminHash = bcrypt.hashSync('admin123', 10);
  const guruHash = bcrypt.hashSync('guru123', 10);
  const siswaHash = bcrypt.hashSync('siswa123', 10);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO schools (name, npsn, address, phone, email, principal_name, academic_year, semester)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'SMK Al-Ghifari',
      '20254108',
      'Jl. Pendidikan Raya No. 45, Kec. Cibiru, Kota Bandung, Jawa Barat 40614',
      '(022) 7801234',
      'info@smkalghifari.sch.id',
      'Drs. H. Ahmad Fauzi, M.Pd.',
      '2026/2027',
      'Ganjil'
    );

    const settings = [
      ['app_name', 'GHIFARI CBT', 'Nama resmi platform ujian'],
      ['tagline', 'Smarter Examination. Better Education.', 'Tagline aplikasi'],
      ['institution', 'SMK AL-GHIFARI', 'Nama institusi pendidikan'],
      ['developer_credit', 'MARGUMI STUDIO', 'Kredit pengembang'],
      ['auto_save_interval_sec', '5', 'Interval auto-save esai dalam detik'],
      ['heartbeat_interval_sec', '15', 'Interval detak jantung koneksi peserta'],
      ['disconnect_threshold_sec', '45', 'Batas waktu status koneksi terputus'],
      ['allow_student_password_change', 'true', 'Izinkan siswa mengganti password'],
    ];
    const insertSetting = db.prepare('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)');
    for (const [k, v, d] of settings) {
      insertSetting.run(k, v, d);
    }

    // Departments
    const deptTkj = Number(db.prepare('INSERT INTO departments (code, name, description) VALUES (?, ?, ?)').run('TKJ', 'Teknik Komputer dan Jaringan', 'Kompetensi keahlian infrastruktur jaringan, server, dan keamanan siber').lastInsertRowid);
    const deptRpl = Number(db.prepare('INSERT INTO departments (code, name, description) VALUES (?, ?, ?)').run('RPL', 'Rekayasa Perangkat Lunak', 'Kompetensi keahlian pemrograman web, desktop, dan basis data').lastInsertRowid);
    const deptAkl = Number(db.prepare('INSERT INTO departments (code, name, description) VALUES (?, ?, ?)').run('AKL', 'Akuntansi dan Keuangan Lembaga', 'Kompetensi keahlian akuntansi keuangan dan perpajakan').lastInsertRowid);

    // Classes
    const clsXTkj1 = Number(db.prepare('INSERT INTO classes (name, grade_level, department_id, academic_year) VALUES (?, ?, ?, ?)').run('X TKJ 1', 'X', deptTkj, '2026/2027').lastInsertRowid);
    const clsXiTkj1 = Number(db.prepare('INSERT INTO classes (name, grade_level, department_id, academic_year) VALUES (?, ?, ?, ?)').run('XI TKJ 1', 'XI', deptTkj, '2026/2027').lastInsertRowid);
    const clsXiRpl1 = Number(db.prepare('INSERT INTO classes (name, grade_level, department_id, academic_year) VALUES (?, ?, ?, ?)').run('XI RPL 1', 'XI', deptRpl, '2026/2027').lastInsertRowid);
    const clsXiiRpl1 = Number(db.prepare('INSERT INTO classes (name, grade_level, department_id, academic_year) VALUES (?, ?, ?, ?)').run('XII RPL 1', 'XII', deptRpl, '2026/2027').lastInsertRowid);
    db.prepare('INSERT INTO classes (name, grade_level, department_id, academic_year) VALUES (?, ?, ?, ?)').run('XI AKL 1', 'XI', deptAkl, '2026/2027');

    // Subjects
    const subjInf = Number(db.prepare('INSERT INTO subjects (code, name, department_id, description) VALUES (?, ?, ?, ?)').run('INF', 'Sistem Operasi & Jaringan', deptTkj, 'Dasar sistem operasi, kernel, manajemen memori, dan jaringan LAN').lastInsertRowid);
    const subjPbo = Number(db.prepare('INSERT INTO subjects (code, name, department_id, description) VALUES (?, ?, ?, ?)').run('PBO', 'Pemrograman Berorientasi Objek', deptRpl, 'Konsep OOP, enkapsulasi, pewarisan, dan polimorfisme').lastInsertRowid);
    const subjMtk = Number(db.prepare('INSERT INTO subjects (code, name, department_id, description) VALUES (?, ?, ?, ?)').run('MTK', 'Matematika Terapan', null, 'Matematika kejuruan untuk seluruh program keahlian').lastInsertRowid);
    db.prepare('INSERT INTO subjects (code, name, department_id, description) VALUES (?, ?, ?, ?)').run('BIN', 'Bahasa Indonesia', null, 'Bahasa Indonesia dan literasi teks teknis');

    // Users: Admin
    const adminUserId = Number(db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run('admin', adminHash, 'Administrator Sekolah', 'admin').lastInsertRowid);

    // Users: Teachers
    const guru1UserId = Number(db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run('guru1', guruHash, 'Budi Santoso, S.Kom.', 'guru').lastInsertRowid);
    db.prepare('INSERT INTO teachers (user_id, nip, phone, email, specialization) VALUES (?, ?, ?, ?, ?)').run(guru1UserId, '198705122011011004', '081234567801', 'budi.santoso@smkalghifari.sch.id', 'Sistem Operasi & Pemrograman');

    const guru2UserId = Number(db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run('guru2', guruHash, 'Siti Rahmawati, S.Pd.', 'guru').lastInsertRowid);
    db.prepare('INSERT INTO teachers (user_id, nip, phone, email, specialization) VALUES (?, ?, ?, ?, ?)').run(guru2UserId, '199008172015022002', '081234567802', 'siti.rahmawati@smkalghifari.sch.id', 'Matematika & Literasi');

    // Users: Students
    const demoStudents = [
      { username: 'siswa1', name: 'Ahmad Zaki Pratama', nis: '24251001', no: 'CBT-2026-001', classId: clsXiTkj1, deptId: deptTkj, gender: 'L' },
      { username: 'siswa2', name: 'Nabila Putri Azzahra', nis: '24251002', no: 'CBT-2026-002', classId: clsXiTkj1, deptId: deptTkj, gender: 'P' },
      { username: 'siswa3', name: 'Rizky Ramadhan', nis: '24251003', no: 'CBT-2026-003', classId: clsXiTkj1, deptId: deptTkj, gender: 'L' },
      { username: 'siswa4', name: 'Dewi Lestari', nis: '24251004', no: 'CBT-2026-004', classId: clsXiTkj1, deptId: deptTkj, gender: 'P' },
      { username: 'siswa5', name: 'Fajar Nugroho', nis: '24251005', no: 'CBT-2026-005', classId: clsXiRpl1, deptId: deptRpl, gender: 'L' },
      { username: 'siswa6', name: 'Intan Permatasari', nis: '24251006', no: 'CBT-2026-006', classId: clsXiRpl1, deptId: deptRpl, gender: 'P' },
      { username: 'siswa7', name: 'Muhammad Ilham', nis: '24251007', no: 'CBT-2026-007', classId: clsXTkj1, deptId: deptTkj, gender: 'L' },
      { username: 'siswa8', name: 'Aulia Salsabila', nis: '24251008', no: 'CBT-2026-008', classId: clsXiiRpl1, deptId: deptRpl, gender: 'P' },
    ];

    const studentIds: Record<string, number> = {};
    for (const s of demoStudents) {
      const uid = Number(db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(s.username, siswaHash, s.name, 'siswa').lastInsertRowid);
      const sid = Number(db.prepare('INSERT INTO students (user_id, nis, participant_number, class_id, department_id, gender) VALUES (?, ?, ?, ?, ?, ?)').run(uid, s.nis, s.no, s.classId, s.deptId, s.gender).lastInsertRowid);
      studentIds[s.username] = sid;
    }

    // Question Bank 1 (Sistem Operasi & Jaringan)
    const bank1Id = Number(db.prepare(`
      INSERT INTO question_banks (title, subject_id, class_level, department_id, topic, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Bank Soal PTS Sistem Operasi & Jaringan', subjInf, 'XI', deptTkj, 'Sistem Operasi & Jaringan LAN', guru1UserId).lastInsertRowid);

    const bank1Questions = [
      {
        code: 'INF-SO-001',
        type: 'PG',
        topic: 'Konsep Sistem Operasi',
        text: 'Apa fungsi utama dari sistem operasi pada sebuah komputer?',
        a: 'Mengelola perangkat keras, memori, dan sumber daya perangkat lunak',
        b: 'Membuat desain grafis vektor beresolusi tinggi',
        c: 'Mengedit video dan audio untuk siaran televisi',
        d: 'Mengolah gambar bitmap secara otomatis',
        e: 'Menggantikan fungsi prosesor dalam perhitungan aritmetika',
        key: 'A',
        score: 10,
      },
      {
        code: 'INF-SO-002',
        type: 'PG',
        topic: 'Kernel Linux',
        text: 'Bagian inti dari sistem operasi Linux yang berinteraksi langsung dengan perangkat keras disebut?',
        a: 'Shell',
        b: 'Kernel',
        c: 'Desktop Environment',
        d: 'Package Manager',
        e: 'Terminal Emulator',
        key: 'B',
        score: 10,
      },
      {
        code: 'INF-JAR-003',
        type: 'PG',
        topic: 'Jaringan Lokal (LAN)',
        text: 'Protokol yang bertugas memberikan alamat IP secara otomatis kepada komputer client di dalam jaringan lokal adalah?',
        a: 'DNS',
        b: 'HTTP',
        c: 'DHCP',
        d: 'FTP',
        e: 'SMTP',
        key: 'C',
        score: 10,
      },
      {
        code: 'INF-JAR-004',
        type: 'PG',
        topic: 'Model OSI',
        text: 'Pada model OSI 7 Layer, perangkat switch layer 2 bekerja pada lapisan?',
        a: 'Physical Layer',
        b: 'Network Layer',
        c: 'Transport Layer',
        d: 'Data Link Layer',
        e: 'Session Layer',
        key: 'D',
        score: 10,
      },
      {
        code: 'INF-JAR-005',
        type: 'PG',
        topic: 'Subnetting IPv4',
        text: 'Berapakah jumlah alamat IP host yang dapat digunakan pada jaringan dengan subnet mask 255.255.255.0 (/24)?',
        a: '126 host',
        b: '254 host',
        c: '255 host',
        d: '256 host',
        e: '510 host',
        key: 'B',
        score: 10,
      },
      {
        code: 'INF-SO-006',
        type: 'PG',
        topic: 'Manajemen Proses',
        text: 'Perintah pada sistem operasi Windows berbasis CMD untuk memeriksa konektivitas ke alamat IP server lokal adalah?',
        a: 'dir',
        b: 'mkdir',
        c: 'ping',
        d: 'format',
        e: 'attrib',
        key: 'C',
        score: 10,
      },
      {
        code: 'INF-SO-007',
        type: 'PG',
        topic: 'Sistem Berkas',
        text: 'Sistem berkas (file system) standar yang digunakan pada instalasi modern Windows Server dan Windows 10/11 dengan dukungan hak akses serta ukuran berkas besar adalah?',
        a: 'FAT16',
        b: 'FAT32',
        c: 'NTFS',
        d: 'ISO9660',
        e: 'SWAP',
        key: 'C',
        score: 10,
      },
      {
        code: 'INF-JAR-008',
        type: 'PG',
        topic: 'Keamanan Jaringan',
        text: 'Port default yang digunakan oleh protokol HTTPS untuk komunikasi web terenkripsi adalah?',
        a: '21',
        b: '22',
        c: '80',
        d: '443',
        e: '3306',
        key: 'D',
        score: 10,
      },
      {
        code: 'INF-SO-009',
        type: 'ESAI',
        topic: 'Konsep Sistem Operasi',
        text: 'Jelaskan secara singkat peran sistem operasi dalam manajemen memori dan penjadwalan proses ketika banyak aplikasi berjalan bersamaan!',
        a: '', b: '', c: '', d: '', e: '',
        key: '',
        score: 15,
      },
      {
        code: 'INF-JAR-010',
        type: 'ESAI',
        topic: 'Jaringan Lokal (LAN)',
        text: 'Sebuah lab komputer SMK memiliki 40 unit PC client yang terhubung ke satu server lokal tanpa internet. Jelaskan langkah konfigurasi IP statis pada server agar seluruh client dapat mengakses layanan web pada port 3000!',
        a: '', b: '', c: '', d: '', e: '',
        key: '',
        score: 15,
      },
    ];

    const insertQ = db.prepare(`
      INSERT INTO questions (
        bank_id, question_code, subject_id, class_level, department_id, topic,
        question_type, question_text, option_a, option_b, option_c, option_d, option_e,
        correct_answer, score, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const bank1QIds: number[] = [];
    for (const q of bank1Questions) {
      const qid = Number(insertQ.run(
        bank1Id, q.code, subjInf, 'XI', deptTkj, q.topic,
        q.type, q.text, q.a, q.b, q.c, q.d, q.e, q.key, q.score, guru1UserId
      ).lastInsertRowid);
      bank1QIds.push(qid);
    }

    // Question Bank 2 (PBO)
    const bank2Id = Number(db.prepare(`
      INSERT INTO question_banks (title, subject_id, class_level, department_id, topic, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Bank Soal Pemrograman Berorientasi Objek', subjPbo, 'XI', deptRpl, 'Konsep OOP Dasar', guru1UserId).lastInsertRowid);

    const bank2Questions = [
      {
        code: 'PBO-OOP-001', type: 'PG', topic: 'Konsep OOP',
        text: 'Mekanisme pembungkusan data (atribut) dan perilaku (metode) dalam satu unit class serta membatasi akses langsung dari luar disebut?',
        a: 'Inheritance', b: 'Polymorphism', c: 'Encapsulation', d: 'Abstraction', e: 'Overloading', key: 'C', score: 10
      },
      {
        code: 'PBO-OOP-002', type: 'PG', topic: 'Konsep OOP',
        text: 'Kata kunci pada Java/TypeScript untuk mewarisi sifat dari kelas induk (superclass) adalah?',
        a: 'implements', b: 'extends', c: 'inherits', d: 'super', e: 'override', key: 'B', score: 10
      },
      {
        code: 'PBO-OOP-003', type: 'PG', topic: 'Konsep OOP',
        text: 'Metode khusus yang otomatis dipanggil saat objek baru dibuat dari sebuah class disebut?',
        a: 'Destructor', b: 'Constructor', c: 'Getter', d: 'Static Method', e: 'Interface', key: 'B', score: 10
      },
      {
        code: 'PBO-OOP-004', type: 'PG', topic: 'Konsep OOP',
        text: 'Kemampuan sebuah metode memiliki banyak bentuk implementasi berbeda pada kelas turunan disebut?',
        a: 'Polymorphism', b: 'Modularity', c: 'Composition', d: 'Aggregation', e: 'Serialization', key: 'A', score: 10
      },
      {
        code: 'PBO-OOP-005', type: 'ESAI', topic: 'Konsep OOP',
        text: 'Berikan contoh studi kasus sederhana di sekolah untuk menjelaskan perbedaan antara Class dan Object!',
        a: '', b: '', c: '', d: '', e: '', key: '', score: 20
      }
    ];

    const bank2QIds: number[] = [];
    for (const q of bank2Questions) {
      const qid = Number(insertQ.run(
        bank2Id, q.code, subjPbo, 'XI', deptRpl, q.topic,
        q.type, q.text, q.a, q.b, q.c, q.d, q.e, q.key, q.score, guru1UserId
      ).lastInsertRowid);
      bank2QIds.push(qid);
    }

    // Bank 3 (Matematika - Guru 2)
    const bank3Id = Number(db.prepare(`
      INSERT INTO question_banks (title, subject_id, class_level, department_id, topic, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Bank Soal Logika & Matriks Matematika', subjMtk, 'XI', null, 'Matriks & Logika', guru2UserId).lastInsertRowid);

    insertQ.run(
      bank3Id, 'MTK-LOG-001', subjMtk, 'XI', null, 'Logika Matematika',
      'PG', 'Nilai kebenaran dari pernyataan konjungsi (p ∧ q) bernilai benar apabila?',
      'p benar dan q salah', 'p salah dan q benar', 'p dan q keduanya benar', 'p dan q keduanya salah', 'minimal salah satu benar',
      'C', 10, guru2UserId
    );

    const today = getLocalDateString(0);
    const yesterday = getLocalDateString(-1);
    const tomorrow = getLocalDateString(1);

    // Exam 1: Active Exam right now for XI TKJ 1
    const exam1Id = Number(db.prepare(`
      INSERT INTO exams (
        title, subject_id, class_id, department_id, bank_id, created_by,
        exam_date, start_time, end_time, duration_minutes, question_count,
        pg_weight, essay_weight, passing_grade, shuffle_questions, shuffle_options, show_result, status, instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Penilaian Tengah Semester — Sistem Operasi & Jaringan',
      subjInf, clsXiTkj1, deptTkj, bank1Id, guru1UserId,
      today, '00:00', '23:59', 60, 10,
      70, 30, 75, 1, 1, 1, 'Berlangsung',
      'Kerjakan soal Pilihan Ganda dan Esai dengan jujur. Sistem akan menyimpan jawaban secara otomatis setiap saat.'
    ).lastInsertRowid);

    const insertEQ = db.prepare('INSERT INTO exam_questions (exam_id, question_id, order_index) VALUES (?, ?, ?)');
    bank1QIds.forEach((qid, idx) => insertEQ.run(exam1Id, qid, idx));

    // Exam 2: Completed Exam with historical participants + results + 1 ungraded essay for demo
    const exam2Id = Number(db.prepare(`
      INSERT INTO exams (
        title, subject_id, class_id, department_id, bank_id, created_by,
        exam_date, start_time, end_time, duration_minutes, question_count,
        pg_weight, essay_weight, passing_grade, shuffle_questions, shuffle_options, show_result, status, instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Evaluasi Harian — Jaringan Komputer & OS',
      subjInf, clsXiTkj1, deptTkj, bank1Id, guru1UserId,
      yesterday, '08:00', '10:00', 45, 5,
      70, 30, 75, 0, 0, 1, 'Selesai',
      'Evaluasi harian materi sistem operasi dan pengalamatan IP.'
    ).lastInsertRowid);

    const exam2QIds = [bank1QIds[0], bank1QIds[1], bank1QIds[2], bank1QIds[3], bank1QIds[8]]; // 4 PG + 1 Essay
    exam2QIds.forEach((qid, idx) => insertEQ.run(exam2Id, qid, idx));

    // Seed participants in Exam 2 (siswa2, siswa3, siswa4)
    const p2 = Number(db.prepare(`
      INSERT INTO exam_participants (exam_id, student_id, status, question_order_json, option_orders_json, started_at, expires_at, submitted_at, last_seen_at, ip_address)
      VALUES (?, ?, 'selesai', ?, '{}', datetime('now', '-1 day', 'localtime'), datetime('now', '-1 day', '+45 minutes', 'localtime'), datetime('now', '-1 day', '+32 minutes', 'localtime'), datetime('now', '-1 day', '+32 minutes', 'localtime'), '192.168.10.21')
    `).run(exam2Id, studentIds['siswa2'], JSON.stringify(exam2QIds)).lastInsertRowid);

    // siswa2 got 4/4 PG correct + Essay graded 14/15 -> 70 + (14/15)*30 = 98
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p2, exam2QIds[0], 'A');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p2, exam2QIds[1], 'B');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p2, exam2QIds[2], 'C');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p2, exam2QIds[3], 'D');
    const ans2Essay = Number(db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, NULL, 14)').run(p2, exam2QIds[4], 'Sistem operasi mengalokasikan blok RAM secara terisolasi untuk tiap aplikasi dan mengatur antrean CPU dengan algoritma penjadwalan seperti Round Robin agar proses berjalan seimbang.').lastInsertRowid);
    db.prepare(`
      INSERT INTO essay_grades (answer_id, participant_id, question_id, score, max_score, feedback, status, graded_by, graded_at)
      VALUES (?, ?, ?, 14, 15, 'Penjelasan sangat tepat dan menyebutkan isolasi memori serta penjadwalan CPU.', 'sudah_dinilai', ?, datetime('now', '-20 hours', 'localtime'))
    `).run(ans2Essay, p2, exam2QIds[4], guru1UserId);
    db.prepare(`
      INSERT INTO exam_results (exam_id, participant_id, student_id, pg_correct, pg_total, pg_score, essay_score, essay_graded, final_score, passed)
      VALUES (?, ?, ?, 4, 4, 100, 93.33, 1, 98.0, 1)
    `).run(exam2Id, p2, studentIds['siswa2']);

    // siswa3 got 3/4 PG + Essay NOT YET graded (to demonstrate pending essay grading!)
    const p3 = Number(db.prepare(`
      INSERT INTO exam_participants (exam_id, student_id, status, question_order_json, option_orders_json, started_at, expires_at, submitted_at, last_seen_at, ip_address)
      VALUES (?, ?, 'selesai', ?, '{}', datetime('now', '-1 day', 'localtime'), datetime('now', '-1 day', '+45 minutes', 'localtime'), datetime('now', '-1 day', '+38 minutes', 'localtime'), datetime('now', '-1 day', '+38 minutes', 'localtime'), '192.168.10.22')
    `).run(exam2Id, studentIds['siswa3'], JSON.stringify(exam2QIds)).lastInsertRowid);

    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p3, exam2QIds[0], 'A');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p3, exam2QIds[1], 'B');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 0, 0)').run(p3, exam2QIds[2], 'A');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p3, exam2QIds[3], 'D');
    const ans3Essay = Number(db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, NULL, 0)').run(p3, exam2QIds[4], 'Sistem operasi membagi RAM dan waktu CPU ke setiap program yang dibuka agar komputer tidak hang.').lastInsertRowid);
    db.prepare(`
      INSERT INTO essay_grades (answer_id, participant_id, question_id, score, max_score, feedback, status)
      VALUES (?, ?, ?, 0, 15, '', 'belum_dinilai')
    `).run(ans3Essay, p3, exam2QIds[4]);
    db.prepare(`
      INSERT INTO exam_results (exam_id, participant_id, student_id, pg_correct, pg_total, pg_score, essay_score, essay_graded, final_score, passed)
      VALUES (?, ?, ?, 3, 4, 75, 0, 0, NULL, NULL)
    `).run(exam2Id, p3, studentIds['siswa3']);

    // siswa4 got 2/4 PG + Essay graded 10/15 -> 0.7*50 + 0.3*(66.67) = 35 + 20 = 55 (Tidak Lulus)
    const p4 = Number(db.prepare(`
      INSERT INTO exam_participants (exam_id, student_id, status, question_order_json, option_orders_json, started_at, expires_at, submitted_at, last_seen_at, ip_address)
      VALUES (?, ?, 'selesai', ?, '{}', datetime('now', '-1 day', 'localtime'), datetime('now', '-1 day', '+45 minutes', 'localtime'), datetime('now', '-1 day', '+41 minutes', 'localtime'), datetime('now', '-1 day', '+41 minutes', 'localtime'), '192.168.10.23')
    `).run(exam2Id, studentIds['siswa4'], JSON.stringify(exam2QIds)).lastInsertRowid);

    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p4, exam2QIds[0], 'A');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 0, 0)').run(p4, exam2QIds[1], 'A');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 0, 0)').run(p4, exam2QIds[2], 'B');
    db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, 1, 10)').run(p4, exam2QIds[3], 'D');
    const ans4Essay = Number(db.prepare('INSERT INTO answers (participant_id, question_id, answer_text, is_correct, earned_score) VALUES (?, ?, ?, NULL, 10)').run(p4, exam2QIds[4], 'Sistem operasi mengatur memori RAM untuk aplikasi.').lastInsertRowid);
    db.prepare(`
      INSERT INTO essay_grades (answer_id, participant_id, question_id, score, max_score, feedback, status, graded_by, graded_at)
      VALUES (?, ?, ?, 10, 15, 'Jawaban benar namun belum menjelaskan mekanisme penjadwalan proses CPU.', 'sudah_dinilai', ?, datetime('now', '-19 hours', 'localtime'))
    `).run(ans4Essay, p4, exam2QIds[4], guru1UserId);
    db.prepare(`
      INSERT INTO exam_results (exam_id, participant_id, student_id, pg_correct, pg_total, pg_score, essay_score, essay_graded, final_score, passed)
      VALUES (?, ?, ?, 2, 4, 50, 66.67, 1, 55.0, 0)
    `).run(exam2Id, p4, studentIds['siswa4']);

    // Exam 3: Scheduled for tomorrow (RPL)
    const exam3Id = Number(db.prepare(`
      INSERT INTO exams (
        title, subject_id, class_id, department_id, bank_id, created_by,
        exam_date, start_time, end_time, duration_minutes, question_count,
        pg_weight, essay_weight, passing_grade, shuffle_questions, shuffle_options, show_result, status, instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Ujian Akhir Modul — Pemrograman Berorientasi Objek',
      subjPbo, clsXiRpl1, deptRpl, bank2Id, guru1UserId,
      tomorrow, '08:00', '10:00', 90, 5,
      80, 20, 75, 1, 1, 1, 'Terjadwal',
      'Ujian baru dapat dibuka sesuai jadwal yang telah ditetapkan.'
    ).lastInsertRowid);
    bank2QIds.forEach((qid, idx) => insertEQ.run(exam3Id, qid, idx));

    // Initial activity logs
    db.prepare(`
      INSERT INTO activity_logs (user_id, username, role, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminUserId, 'admin', 'admin', 'INIT_SYSTEM', 'system', '1', 'Inisialisasi awal sistem GHIFARI CBT SMK Al-Ghifari dan data demo.', '127.0.0.1');

    db.prepare(`
      INSERT INTO activity_logs (user_id, username, role, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(guru1UserId, 'guru1', 'guru', 'CREATE_EXAM', 'exam', String(exam1Id), 'Menerbitkan ujian Penilaian Tengah Semester — Sistem Operasi & Jaringan.', '192.168.10.2');
  });

  tx();
}
