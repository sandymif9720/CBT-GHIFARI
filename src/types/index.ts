export type UserRole = 'admin' | 'guru' | 'siswa';

export interface School {
  id: number;
  name: string;
  npsn: string;
  address: string;
  phone: string;
  email: string;
  principal_name: string;
  academic_year: string;
  semester: string;
}

export interface StudentProfile {
  id: number;
  nis: string;
  participant_number: string;
  class_id: number | null;
  department_id: number | null;
  gender: 'L' | 'P';
  phone: string;
  class_name?: string;
  grade_level?: string;
  department_code?: string;
  department_name?: string;
}

export interface TeacherProfile {
  id: number;
  nip: string;
  phone: string;
  email: string;
  specialization: string;
}

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  lastLoginAt: string | null;
  teacher?: TeacherProfile | null;
  student?: StudentProfile | null;
  school?: School | null;
  lanIps?: string[];
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description: string;
  class_count?: number;
  student_count?: number;
}

export interface ClassRoom {
  id: number;
  name: string;
  grade_level: string;
  department_id: number | null;
  department_code?: string;
  department_name?: string;
  academic_year: string;
  student_count?: number;
}

export interface Subject {
  id: number;
  code: string;
  name: string;
  department_id: number | null;
  department_code?: string;
  department_name?: string;
  description: string;
  question_count?: number;
}

export interface TeacherRow {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  is_active: number;
  last_login_at: string | null;
  nip: string;
  phone: string;
  email: string;
  specialization: string;
}

export interface StudentRow {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  is_active: number;
  last_login_at: string | null;
  nis: string;
  participant_number: string;
  class_id: number | null;
  department_id: number | null;
  class_name?: string;
  department_code?: string;
  department_name?: string;
  gender: 'L' | 'P';
  phone: string;
}

export interface QuestionBank {
  id: number;
  title: string;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  class_level: string;
  department_id: number | null;
  department_code?: string;
  department_name?: string;
  topic: string;
  created_by: number;
  creator_name?: string;
  total_questions?: number;
  pg_count?: number;
  essay_count?: number;
  updated_at: string;
}

export interface Question {
  id: number;
  bank_id: number;
  bank_title?: string;
  question_code: string;
  subject_id: number;
  subject_name?: string;
  class_level: string;
  department_id: number | null;
  department_code?: string;
  topic: string;
  question_type: 'PG' | 'ESAI';
  question_text: string;
  image_url?: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_answer: string;
  score: number;
}

export type ExamStatus = 'Draft' | 'Terjadwal' | 'Berlangsung' | 'Selesai' | 'Dibatalkan';

export interface Exam {
  id: number;
  title: string;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  class_id: number;
  class_name?: string;
  department_id: number | null;
  department_code?: string;
  department_name?: string;
  bank_id: number | null;
  bank_title?: string;
  created_by: number;
  creator_name?: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  question_count: number;
  pg_weight: number;
  essay_weight: number;
  passing_grade: number;
  shuffle_questions: number;
  shuffle_options: number;
  show_result: number;
  status: ExamStatus;
  instructions: string;
  assigned_questions?: number;
  participant_count?: number;
  class_student_count?: number;
}

export interface StudentExamCard {
  id: number;
  title: string;
  subjectName: string;
  subjectCode: string;
  className: string;
  teacherName: string;
  examDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  questionCount: number;
  passingGrade: number;
  showResult: boolean;
  examStatus: ExamStatus;
  instructions: string;
  participantStatus: 'belum_mulai' | 'sedang_mengerjakan' | 'terputus' | 'selesai' | 'waktu_habis';
  canStart: boolean;
  scheduleNote: string;
  result: {
    pgCorrect: number;
    pgTotal: number;
    pgScore: number;
    essayScore: number;
    essayGraded: boolean;
    finalScore: number | null;
    passed: boolean | null;
  } | null;
}
