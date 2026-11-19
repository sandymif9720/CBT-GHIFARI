import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardCheck,
  Activity,
  Award,
  Search,
  Shuffle,
  Eye,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import type { ClassRoom, Department, Exam, ExamStatus, Question, QuestionBank, Subject } from '../../types';

interface ExamManagementPageProps {
  globalSearch: string;
  onOpenMonitoring: (examId: number) => void;
  onOpenGrading: (examId: number) => void;
}

const STATUS_LIST: ExamStatus[] = ['Draft', 'Terjadwal', 'Berlangsung', 'Selesai', 'Dibatalkan'];

export const ExamManagementPage: React.FC<ExamManagementPageProps> = ({
  globalSearch,
  onOpenMonitoring,
  onOpenGrading,
}) => {
  const { showToast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: '',
    subject_id: '',
    class_id: '',
    department_id: '',
    bank_id: '',
    exam_date: todayStr,
    start_time: '07:30',
    end_time: '09:30',
    duration_minutes: '60',
    question_count: '10',
    pg_weight: '70',
    essay_weight: '30',
    passing_grade: '75',
    shuffle_questions: true,
    shuffle_options: true,
    show_result: true,
    status: 'Terjadwal' as ExamStatus,
    instructions: 'Bacalah setiap soal dengan teliti sebelum memilih atau menuliskan jawaban.',
    selected_question_ids: [] as number[],
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [eRes, refRes, bRes] = await Promise.all([
        apiFetch<{ exams: Exam[] }>('/api/exams'),
        apiFetch<{ subjects: Subject[]; classes: ClassRoom[]; departments: Department[] }>('/api/admin/master/references'),
        apiFetch<{ banks: QuestionBank[] }>('/api/questions/banks'),
      ]);
      setExams(eRes.exams);
      setSubjects(refRes.subjects);
      setClasses(refRes.classes);
      setDepartments(refRes.departments);
      setBanks(bRes.banks);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadQuestionsForBank = async (bankId: string) => {
    if (!bankId) {
      setBankQuestions([]);
      return;
    }
    try {
      const res = await apiFetch<{ questions: Question[] }>(`/api/questions?bank_id=${bankId}`);
      setBankQuestions(res.questions);
      return res.questions;
    } catch {
      return [];
    }
  };

  const openAdd = async () => {
    setEditing(null);
    const firstBankId = banks[0] ? String(banks[0].id) : '';
    const firstClass = classes[0];
    const qs = firstBankId ? (await loadQuestionsForBank(firstBankId)) || [] : [];
    setForm({
      title: '',
      subject_id: banks[0] ? String(banks[0].subject_id) : subjects[0] ? String(subjects[0].id) : '',
      class_id: firstClass ? String(firstClass.id) : '',
      department_id: firstClass?.department_id ? String(firstClass.department_id) : '',
      bank_id: firstBankId,
      exam_date: todayStr,
      start_time: '07:30',
      end_time: '23:59',
      duration_minutes: '60',
      question_count: String(qs.length || 10),
      pg_weight: '70',
      essay_weight: '30',
      passing_grade: '75',
      shuffle_questions: true,
      shuffle_options: true,
      show_result: true,
      status: 'Berlangsung',
      instructions: 'Bacalah setiap soal dengan teliti sebelum memilih atau menuliskan jawaban.',
      selected_question_ids: qs.map((q) => q.id),
    });
    setModalOpen(true);
  };

  const openEdit = async (ex: Exam) => {
    setEditing(ex);
    const detail = await apiFetch<{ exam: Exam; questions: Question[] }>(`/api/exams/${ex.id}`);
    if (ex.bank_id) {
      await loadQuestionsForBank(String(ex.bank_id));
    } else {
      setBankQuestions(detail.questions || []);
    }
    setForm({
      title: ex.title,
      subject_id: String(ex.subject_id),
      class_id: String(ex.class_id),
      department_id: ex.department_id ? String(ex.department_id) : '',
      bank_id: ex.bank_id ? String(ex.bank_id) : '',
      exam_date: ex.exam_date,
      start_time: ex.start_time,
      end_time: ex.end_time,
      duration_minutes: String(ex.duration_minutes),
      question_count: String(ex.question_count),
      pg_weight: String(ex.pg_weight),
      essay_weight: String(ex.essay_weight),
      passing_grade: String(ex.passing_grade),
      shuffle_questions: Boolean(ex.shuffle_questions),
      shuffle_options: Boolean(ex.shuffle_options),
      show_result: Boolean(ex.show_result),
      status: ex.status,
      instructions: ex.instructions || '',
      selected_question_ids: (detail.questions || []).map((q) => q.id),
    });
    setModalOpen(true);
  };

  const handleBankChange = async (bankId: string) => {
    const selectedBank = banks.find((b) => String(b.id) === bankId);
    const qs = (await loadQuestionsForBank(bankId)) || [];
    setForm((prev) => ({
      ...prev,
      bank_id: bankId,
      subject_id: selectedBank ? String(selectedBank.subject_id) : prev.subject_id,
      question_count: String(qs.length || prev.question_count),
      selected_question_ids: qs.map((q) => q.id),
    }));
  };

  const toggleQuestionId = (qid: number) => {
    setForm((prev) => {
      const exists = prev.selected_question_ids.includes(qid);
      const next = exists
        ? prev.selected_question_ids.filter((id) => id !== qid)
        : [...prev.selected_question_ids, qid];
      return {
        ...prev,
        selected_question_ids: next,
        question_count: String(next.length),
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.selected_question_ids.length === 0) {
      showToast('Pilih minimal 1 butir soal untuk ujian ini.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        subject_id: Number(form.subject_id),
        class_id: Number(form.class_id),
        department_id: form.department_id ? Number(form.department_id) : null,
        bank_id: form.bank_id ? Number(form.bank_id) : null,
        duration_minutes: Number(form.duration_minutes),
        question_count: form.selected_question_ids.length,
        pg_weight: Number(form.pg_weight),
        essay_weight: Number(form.essay_weight),
        passing_grade: Number(form.passing_grade),
      };
      if (editing) {
        await apiFetch(`/api/exams/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Konfigurasi ujian berhasil diperbarui.', 'success');
      } else {
        await apiFetch('/api/exams', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Ujian baru berhasil dibuat.', 'success');
      }
      setModalOpen(false);
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/exams/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Ujian berhasil dihapus.', 'success');
      setDeleteTarget(null);
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const query = (search || globalSearch).trim().toLowerCase();
  const filtered = useMemo(
    () =>
      exams.filter((ex) => {
        if (statusFilter && ex.status !== statusFilter) return false;
        if (!query) return true;
        return (
          ex.title.toLowerCase().includes(query) ||
          (ex.subject_name || '').toLowerCase().includes(query) ||
          (ex.class_name || '').toLowerCase().includes(query)
        );
      }),
    [exams, statusFilter, query]
  );

  const statusColor = (st: ExamStatus) => {
    if (st === 'Berlangsung') return 'text-[#16A36A]';
    if (st === 'Terjadwal') return 'text-[#2563EB]';
    if (st === 'Dibatalkan') return 'text-[#DC2626]';
    if (st === 'Selesai') return 'text-slate-600';
    return 'text-amber-700';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Manajemen Ujian CBT</h1>
          <p className="text-xs text-slate-500 mt-1">Atur jadwal, durasi, bobot penilaian PG/Esai, KKM, dan pengacakan soal.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Buat Ujian Baru
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama ujian, mapel, kelas..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                statusFilter === '' ? 'bg-white text-[#102B50] shadow-sm' : 'text-slate-600'
              }`}
            >
              Semua
            </button>
            {STATUS_LIST.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                  statusFilter === st ? 'bg-white text-[#102B50] shadow-sm' : 'text-slate-600'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat daftar ujian...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ClipboardCheck className="w-6 h-6" />}
              title="Belum ada ujian"
              description="Buat jadwal ujian baru dan hubungkan dengan butir soal dari Bank Soal."
              action={
                <button type="button" onClick={openAdd} className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg">
                  Buat Ujian Pertama
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Nama Ujian & Mapel</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Jadwal</th>
                  <th className="py-3 px-4 text-right">Durasi & Soal</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <p className="font-bold text-[#102B50]">{ex.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {ex.subject_name} · KKM {ex.passing_grade} · {ex.shuffle_questions ? 'Acak Soal' : 'Urut'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{ex.class_name}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                      {ex.exam_date} · {ex.start_time}–{ex.end_time}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {ex.duration_minutes} mnt · {ex.assigned_questions ?? ex.question_count} soal
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`font-bold ${statusColor(ex.status)}`}>{ex.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenMonitoring(ex.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#102B50] hover:bg-slate-100 inline-flex items-center gap-1 mr-1"
                        title="Monitoring Peserta"
                      >
                        <Activity className="w-3.5 h-3.5 text-[#16A36A]" /> Pantau
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenGrading(ex.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#102B50] hover:bg-slate-100 inline-flex items-center gap-1 mr-1"
                        title="Penilaian & Hasil"
                      >
                        <Award className="w-3.5 h-3.5 text-[#2563EB]" /> Nilai
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(ex)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 mr-1"
                        title="Edit Ujian"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(ex)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-[#DC2626] hover:bg-red-50"
                        title="Hapus Ujian"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Create / Edit Exam */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Pengaturan Ujian' : 'Buat Ujian CBT Baru'}
        subtitle="Konfigurasi jadwal, bobot penilaian, keamanan acak soal, dan butir soal."
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Ujian *</label>
              <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Penilaian Akhir Semester — Sistem Operasi" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Soal Sumber</label>
              <select value={form.bank_id} onChange={(e) => handleBankChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">-- Pilih Bank Soal --</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.total_questions} soal)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran *</label>
              <select required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">-- Pilih Mapel --</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas Peserta *</label>
              <select
                required
                value={form.class_id}
                onChange={(e) => {
                  const cls = classes.find((c) => String(c.id) === e.target.value);
                  setForm({
                    ...form,
                    class_id: e.target.value,
                    department_id: cls?.department_id ? String(cls.department_id) : form.department_id,
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">-- Pilih Kelas --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status Ujian *</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ExamStatus })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-semibold">
                {STATUS_LIST.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Ujian *</label>
              <input type="date" required value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Mulai *</label>
              <input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Selesai *</label>
              <input type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Durasi (Menit) *</label>
              <input type="number" min="5" required value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bobot PG (%)</label>
              <input type="number" min="0" max="100" value={form.pg_weight} onChange={(e) => setForm({ ...form, pg_weight: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bobot Esai (%)</label>
              <input type="number" min="0" max="100" value={form.essay_weight} onChange={(e) => setForm({ ...form, essay_weight: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">KKM / Passing Grade</label>
              <input type="number" min="0" max="100" value={form.passing_grade} onChange={(e) => setForm({ ...form, passing_grade: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums" />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={form.shuffle_questions} onChange={(e) => setForm({ ...form, shuffle_questions: e.target.checked })} className="rounded border-slate-300 text-[#2563EB]" />
              <Shuffle className="w-3.5 h-3.5 text-slate-500" /> Acak Urutan Soal
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={form.shuffle_options} onChange={(e) => setForm({ ...form, shuffle_options: e.target.checked })} className="rounded border-slate-300 text-[#2563EB]" />
              <Shuffle className="w-3.5 h-3.5 text-slate-500" /> Acak Opsi Jawaban
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={form.show_result} onChange={(e) => setForm({ ...form, show_result: e.target.checked })} className="rounded border-slate-300 text-[#2563EB]" />
              <Eye className="w-3.5 h-3.5 text-slate-500" /> Tampilkan Nilai ke Siswa
            </label>
          </div>

          {/* Question Picker */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#102B50]">
                Pilih Butir Soal ({form.selected_question_ids.length} terpilih)
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    selected_question_ids:
                      prev.selected_question_ids.length === bankQuestions.length ? [] : bankQuestions.map((q) => q.id),
                  }))
                }
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                {form.selected_question_ids.length === bankQuestions.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {bankQuestions.length === 0 ? (
                <p className="p-4 text-xs text-slate-500 text-center">Pilih Bank Soal di atas untuk menampilkan daftar butir soal.</p>
              ) : (
                bankQuestions.map((q) => {
                  const checked = form.selected_question_ids.includes(q.id);
                  return (
                    <label key={q.id} className="flex items-start gap-2.5 p-2.5 hover:bg-slate-50 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleQuestionId(q.id)}
                        className="mt-0.5 rounded border-slate-300 text-[#2563EB]"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-semibold text-[#2563EB] mr-2">{q.question_code}</span>
                        <span className="font-semibold text-slate-600 mr-2">[{q.question_type}]</span>
                        <span className="text-slate-800">{q.question_text}</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Instruksi Pengerjaan</label>
            <textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg">Batal</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan Ujian'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Hapus Ujian" message={`Hapus ujian "${deleteTarget?.title}" beserta seluruh data partisipan dan nilainya?`} />
    </div>
  );
};
