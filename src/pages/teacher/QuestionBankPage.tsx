import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  Upload,
  FolderPlus,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch, downloadFile, getStoredToken } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Department, Question, QuestionBank, Subject } from '../../types';

export const QuestionBankPage: React.FC<{ globalSearch: string }> = ({ globalSearch }) => {
  const { showToast } = useToast();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Bank Modal
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [bankForm, setBankForm] = useState({
    title: '',
    subject_id: '',
    class_level: 'XI',
    department_id: '',
    topic: '',
  });
  const [deleteBankTarget, setDeleteBankTarget] = useState<QuestionBank | null>(null);

  // Question Modal
  const [qModalOpen, setQModalOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [qForm, setQForm] = useState({
    bank_id: '',
    question_code: '',
    topic: '',
    question_type: 'PG' as 'PG' | 'ESAI',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    option_e: '',
    correct_answer: 'A',
    score: '10',
  });
  const [deleteQTarget, setDeleteQTarget] = useState<Question | null>(null);

  // Excel Import Modal
  const [importOpen, setImportOpen] = useState(false);
  const [importBankId, setImportBankId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [bRes, qRes, refRes] = await Promise.all([
        apiFetch<{ banks: QuestionBank[] }>('/api/questions/banks'),
        apiFetch<{ questions: Question[] }>('/api/questions'),
        apiFetch<{ subjects: Subject[]; departments: Department[] }>('/api/admin/master/references'),
      ]);
      setBanks(bRes.banks);
      setQuestions(qRes.questions);
      setSubjects(refRes.subjects);
      setDepartments(refRes.departments);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const query = (search || globalSearch).trim().toLowerCase();
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedBankId && String(q.bank_id) !== selectedBankId) return false;
      if (subjectFilter && String(q.subject_id) !== subjectFilter) return false;
      if (classFilter && q.class_level !== classFilter) return false;
      if (deptFilter && String(q.department_id) !== deptFilter) return false;
      if (typeFilter && q.question_type !== typeFilter) return false;
      if (!query) return true;
      return (
        q.question_text.toLowerCase().includes(query) ||
        q.question_code.toLowerCase().includes(query) ||
        q.topic.toLowerCase().includes(query)
      );
    });
  }, [questions, selectedBankId, subjectFilter, classFilter, deptFilter, typeFilter, query]);

  const handleDownloadTemplate = async () => {
    try {
      await downloadFile('/api/questions/template', 'template-soal-ghifari-cbt.xlsx');
      showToast('Template Excel (sheet SOAL) berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Bank CRUD
  const openAddBank = () => {
    setEditingBank(null);
    setBankForm({
      title: '',
      subject_id: subjects[0] ? String(subjects[0].id) : '',
      class_level: 'XI',
      department_id: '',
      topic: '',
    });
    setBankModalOpen(true);
  };

  const openEditBank = (b: QuestionBank) => {
    setEditingBank(b);
    setBankForm({
      title: b.title,
      subject_id: String(b.subject_id),
      class_level: b.class_level,
      department_id: b.department_id ? String(b.department_id) : '',
      topic: b.topic,
    });
    setBankModalOpen(true);
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...bankForm,
        subject_id: Number(bankForm.subject_id),
        department_id: bankForm.department_id ? Number(bankForm.department_id) : null,
      };
      if (editingBank) {
        await apiFetch(`/api/questions/banks/${editingBank.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Bank soal berhasil diperbarui.', 'success');
      } else {
        await apiFetch('/api/questions/banks', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Bank soal baru berhasil dibuat.', 'success');
      }
      setBankModalOpen(false);
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteBank = async () => {
    if (!deleteBankTarget) return;
    try {
      await apiFetch(`/api/questions/banks/${deleteBankTarget.id}`, { method: 'DELETE' });
      showToast('Bank soal berhasil dihapus.', 'success');
      if (selectedBankId === String(deleteBankTarget.id)) setSelectedBankId('');
      setDeleteBankTarget(null);
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Question CRUD
  const openAddQuestion = () => {
    const defaultBank = selectedBankId || (banks[0] ? String(banks[0].id) : '');
    if (!defaultBank) {
      showToast('Buat Bank Soal terlebih dahulu sebelum menambahkan butir soal.', 'error');
      return;
    }
    setEditingQ(null);
    setQForm({
      bank_id: defaultBank,
      question_code: `SOAL-${String(questions.length + 1).padStart(3, '0')}`,
      topic: '',
      question_type: 'PG',
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      option_e: '',
      correct_answer: 'A',
      score: '10',
    });
    setQModalOpen(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQ(q);
    setQForm({
      bank_id: String(q.bank_id),
      question_code: q.question_code,
      topic: q.topic,
      question_type: q.question_type,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_e: q.option_e,
      correct_answer: q.correct_answer || 'A',
      score: String(q.score),
    });
    setQModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...qForm, bank_id: Number(qForm.bank_id), score: Number(qForm.score) };
      if (editingQ) {
        await apiFetch(`/api/questions/${editingQ.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Butir soal berhasil diperbarui.', 'success');
      } else {
        await apiFetch('/api/questions', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Butir soal berhasil ditambahkan.', 'success');
      }
      setQModalOpen(false);
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteQuestion = async () => {
    if (!deleteQTarget) return;
    try {
      await apiFetch(`/api/questions/${deleteQTarget.id}`, { method: 'DELETE' });
      showToast('Butir soal berhasil dihapus.', 'success');
      setDeleteQTarget(null);
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Excel Import
  const openImportModal = () => {
    const defaultBank = selectedBankId || (banks[0] ? String(banks[0].id) : '');
    if (!defaultBank) {
      showToast('Buat Bank Soal terlebih dahulu sebelum mengimpor Excel.', 'error');
      return;
    }
    setImportBankId(defaultBank);
    setImportFile(null);
    setPreviewData(null);
    setImportResult(null);
    setAllowDuplicates(false);
    setImportOpen(true);
  };

  const handlePreviewExcel = async () => {
    if (!importFile || !importBankId) {
      showToast('Pilih bank soal tujuan dan file Excel (.xlsx).', 'error');
      return;
    }
    setPreviewing(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('bank_id', importBankId);
      const token = getStoredToken();
      const res = await fetch('/api/questions/import/preview', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memvalidasi file Excel.');
      setPreviewData(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !importBankId) return;
    setImporting(true);
    try {
      const res = await apiFetch('/api/questions/import/confirm', {
        method: 'POST',
        body: JSON.stringify({
          bank_id: Number(importBankId),
          rows: previewData.rows,
          allow_duplicates: allowDuplicates,
        }),
      });
      setImportResult(res);
      showToast(res.message, 'success');
      loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Bank Soal & Impor Excel</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelompokkan butir soal Pilihan Ganda (A–E) dan Esai berdasarkan mapel, kelas, jurusan, dan materi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 text-xs font-semibold text-[#102B50] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" /> Template Excel
          </button>
          <button
            type="button"
            onClick={openImportModal}
            className="px-3.5 py-2 text-xs font-semibold text-[#102B50] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4 text-[#2563EB]" /> Impor Excel
          </button>
          <button
            type="button"
            onClick={openAddBank}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#102B50] hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-4 h-4" /> Bank Soal Baru
          </button>
          <button
            type="button"
            onClick={openAddQuestion}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" /> Tambah Soal
          </button>
        </div>
      </div>

      {/* Question Banks Selector Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedBankId('')}
          className={`text-left p-4 rounded-xl border transition-colors ${
            selectedBankId === ''
              ? 'bg-[#102B50] text-white border-[#102B50]'
              : 'bg-white text-slate-800 border-slate-200 hover:border-[#2563EB]'
          }`}
        >
          <p className={`text-xs font-medium ${selectedBankId === '' ? 'text-blue-200' : 'text-slate-500'}`}>
            Semua Koleksi
          </p>
          <p className="text-sm font-bold mt-1">Seluruh Bank Soal ({banks.length})</p>
          <p className={`text-xs mt-2 tabular-nums ${selectedBankId === '' ? 'text-blue-100' : 'text-slate-500'}`}>
            {questions.length} total butir soal
          </p>
        </button>

        {banks.map((b) => {
          const active = selectedBankId === String(b.id);
          return (
            <div
              key={b.id}
              className={`rounded-xl border p-4 transition-colors flex flex-col justify-between ${
                active ? 'bg-blue-50/70 border-[#2563EB]' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <button type="button" onClick={() => setSelectedBankId(String(b.id))} className="text-left w-full">
                <p className="text-[11px] font-semibold text-[#2563EB]">
                  {b.subject_code} · Kelas {b.class_level} {b.department_code ? `· ${b.department_code}` : ''}
                </p>
                <p className="text-sm font-bold text-[#102B50] mt-0.5 line-clamp-1">{b.title}</p>
              </button>
              <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
                <span className="tabular-nums">
                  {b.total_questions ?? 0} soal ({b.pg_count ?? 0} PG · {b.essay_count ?? 0} Esai)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditBank(b)}
                    className="p-1 rounded hover:bg-white text-slate-500 hover:text-[#2563EB]"
                    title="Edit Bank"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteBankTarget(b)}
                    className="p-1 rounded hover:bg-white text-slate-500 hover:text-[#DC2626]"
                    title="Hapus Bank"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter & Questions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, pertanyaan, materi..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">Semua Mapel</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">Semua Tingkat</option>
            <option value="X">Kelas X</option>
            <option value="XI">Kelas XI</option>
            <option value="XII">Kelas XII</option>
          </select>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">Semua Jurusan</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">Semua Tipe</option>
            <option value="PG">Pilihan Ganda</option>
            <option value="ESAI">Esai</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat daftar soal...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileSpreadsheet className="w-6 h-6" />}
              title="Belum ada butir soal"
              description="Tambahkan soal secara manual atau impor langsung dari file Excel menggunakan template resmi GHIFARI CBT."
              action={
                <div className="flex gap-2">
                  <button type="button" onClick={openImportModal} className="px-4 py-2 text-xs font-semibold text-[#102B50] border border-slate-300 rounded-lg">
                    Impor Excel
                  </button>
                  <button type="button" onClick={openAddQuestion} className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg">
                    Tambah Soal
                  </button>
                </div>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQuestions.map((q, idx) => (
              <div key={q.id} className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-bold text-[#102B50]">#{idx + 1}</span>
                    <span className="font-mono text-[#2563EB] font-semibold">{q.question_code}</span>
                    <span>·</span>
                    <span className="font-semibold text-slate-700">{q.question_type === 'PG' ? 'Pilihan Ganda' : 'Esai'}</span>
                    <span>·</span>
                    <span>{q.subject_name}</span>
                    <span>·</span>
                    <span>Kelas {q.class_level}{q.department_code ? ` ${q.department_code}` : ''}</span>
                    {q.topic && (
                      <>
                        <span>·</span>
                        <span>Materi: {q.topic}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="font-semibold text-[#102B50] tabular-nums">Skor: {q.score}</span>
                  </div>

                  <p className="text-sm font-medium text-slate-900 leading-relaxed">{q.question_text}</p>

                  {q.question_type === 'PG' && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 pt-1 text-xs">
                      {(['A', 'B', 'C', 'D', 'E'] as const).map((opt) => {
                        const val = q[`option_${opt.toLowerCase()}` as keyof Question] as string;
                        const isKey = q.correct_answer === opt;
                        return (
                          <div key={opt} className={`flex items-start gap-1.5 ${isKey ? 'font-bold text-[#16A36A]' : 'text-slate-600'}`}>
                            <span className="font-mono shrink-0">{opt}.</span>
                            <span>{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditQuestion(q)}
                    className="p-2 rounded-lg text-slate-500 hover:text-[#2563EB] hover:bg-blue-50"
                    title="Edit Soal"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteQTarget(q)}
                    className="p-2 rounded-lg text-slate-500 hover:text-[#DC2626] hover:bg-red-50"
                    title="Hapus Soal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Bank Soal */}
      <Modal open={bankModalOpen} onClose={() => setBankModalOpen(false)} title={editingBank ? 'Edit Bank Soal' : 'Buat Bank Soal Baru'} maxWidthClass="max-w-md">
        <form onSubmit={handleSaveBank} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Bank Soal *</label>
            <input type="text" required value={bankForm.title} onChange={(e) => setBankForm({ ...bankForm, title: e.target.value })} placeholder="Misal: Bank Soal UTS Jaringan XI" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran *</label>
            <select required value={bankForm.subject_id} onChange={(e) => setBankForm({ ...bankForm, subject_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">-- Pilih Mapel --</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat Kelas</label>
              <select value={bankForm.class_level} onChange={(e) => setBankForm({ ...bankForm, class_level: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="X">Kelas X</option>
                <option value="XI">Kelas XI</option>
                <option value="XII">Kelas XII</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jurusan</label>
              <select value={bankForm.department_id} onChange={(e) => setBankForm({ ...bankForm, department_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">Semua Jurusan</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Materi Pokok</label>
            <input type="text" value={bankForm.topic} onChange={(e) => setBankForm({ ...bankForm, topic: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setBankModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg">Batal</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700">Simpan Bank Soal</button>
          </div>
        </form>
      </Modal>

      {/* Modal Tambah / Edit Soal */}
      <Modal open={qModalOpen} onClose={() => setQModalOpen(false)} title={editingQ ? 'Edit Butir Soal' : 'Tambah Butir Soal'} maxWidthClass="max-w-2xl">
        <form onSubmit={handleSaveQuestion} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Soal *</label>
              <select required disabled={Boolean(editingQ)} value={qForm.bank_id} onChange={(e) => setQForm({ ...qForm, bank_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100">
                {banks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Soal</label>
              <input type="text" value={qForm.question_code} onChange={(e) => setQForm({ ...qForm, question_code: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Soal *</label>
              <select value={qForm.question_type} onChange={(e) => setQForm({ ...qForm, question_type: e.target.value as 'PG' | 'ESAI' })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="PG">Pilihan Ganda (A–E)</option>
                <option value="ESAI">Esai (Uraian)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Materi</label>
              <input type="text" value={qForm.topic} onChange={(e) => setQForm({ ...qForm, topic: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Skor Maksimal *</label>
              <input type="number" min="1" step="0.5" required value={qForm.score} onChange={(e) => setQForm({ ...qForm, score: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Pertanyaan *</label>
            <textarea rows={3} required value={qForm.question_text} onChange={(e) => setQForm({ ...qForm, question_text: e.target.value })} placeholder="Tuliskan pertanyaan dengan jelas..." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>

          {qForm.question_type === 'PG' && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-[#102B50]">Pilihan Jawaban (A–E) & Kunci Jawaban</p>
              {(['a', 'b', 'c', 'd', 'e'] as const).map((opt) => (
                <div key={opt} className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-md bg-slate-100 text-[#102B50] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {opt.toUpperCase()}
                  </span>
                  <input
                    type="text"
                    required
                    value={qForm[`option_${opt}`]}
                    onChange={(e) => setQForm({ ...qForm, [`option_${opt}`]: e.target.value })}
                    placeholder={`Opsi ${opt.toUpperCase()}`}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              ))}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kunci Jawaban Benar *</label>
                <select value={qForm.correct_answer} onChange={(e) => setQForm({ ...qForm, correct_answer: e.target.value })} className="w-40 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-bold">
                  <option value="A">Opsi A</option>
                  <option value="B">Opsi B</option>
                  <option value="C">Opsi C</option>
                  <option value="D">Opsi D</option>
                  <option value="E">Opsi E</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setQModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg">Batal</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700">Simpan Soal</button>
          </div>
        </form>
      </Modal>

      {/* Modal Impor Excel */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Impor Soal dari Excel (.xlsx)"
        subtitle="Gunakan template resmi GHIFARI CBT (sheet SOAL). Sistem akan memvalidasi setiap baris sebelum disimpan."
        maxWidthClass="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-12 gap-3 items-end bg-[#F5F7FB] p-4 rounded-xl border border-slate-200">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Soal Tujuan</label>
              <select value={importBankId} onChange={(e) => setImportBankId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {banks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </div>
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Berkas Excel (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setPreviewData(null);
                  setImportResult(null);
                }}
                className="block w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-[#102B50]"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={!importFile || previewing}
                onClick={handlePreviewExcel}
                className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#102B50] hover:bg-slate-800 rounded-lg disabled:opacity-50"
              >
                {previewing ? 'Memeriksa...' : 'Preview'}
              </button>
            </div>
          </div>

          {previewData && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-4 tabular-nums">
                  <span>Total Baris: <strong className="text-[#102B50]">{previewData.summary.totalRows}</strong></span>
                  <span className="text-[#16A36A] font-semibold">Valid: {previewData.summary.validCount}</span>
                  <span className="text-[#DC2626] font-semibold">Bermasalah: {previewData.summary.errorCount}</span>
                  <span className="text-amber-700 font-semibold">Terdeteksi Duplikat: {previewData.summary.duplicateCount}</span>
                </div>

                {previewData.summary.duplicateCount > 0 && (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-amber-800">
                    <input
                      type="checkbox"
                      checked={allowDuplicates}
                      onChange={(e) => setAllowDuplicates(e.target.checked)}
                      className="rounded border-amber-400"
                    />
                    Izinkan impor baris duplikat
                  </label>
                )}
              </div>

              <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[11px] text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Baris</th>
                      <th className="py-2 px-3">Kode</th>
                      <th className="py-2 px-3">Tipe</th>
                      <th className="py-2 px-3">Pertanyaan</th>
                      <th className="py-2 px-3">Kunci</th>
                      <th className="py-2 px-3">Skor</th>
                      <th className="py-2 px-3">Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.rows.map((r: any) => (
                      <tr key={r.rowNumber} className={!r.isValid ? 'bg-red-50/70' : r.isDuplicate ? 'bg-amber-50/60' : ''}>
                        <td className="py-2 px-3 font-mono tabular-nums">{r.rowNumber}</td>
                        <td className="py-2 px-3 font-mono">{r.kode_soal}</td>
                        <td className="py-2 px-3 font-semibold">{r.jenis_soal}</td>
                        <td className="py-2 px-3 max-w-xs truncate">{r.pertanyaan || '-'}</td>
                        <td className="py-2 px-3 font-mono">{r.kunci_jawaban || '-'}</td>
                        <td className="py-2 px-3 tabular-nums">{r.skor}</td>
                        <td className="py-2 px-3">
                          {!r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[#DC2626] font-medium">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              {r.errors.join(', ')}
                            </span>
                          ) : r.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Duplikat
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#16A36A] font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Siap Impor
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importResult && (
                <div className="p-4 rounded-lg bg-emerald-50 border border-[#16A36A]/30 text-xs text-slate-800 space-y-1">
                  <p className="font-bold text-[#16A36A]">Laporan Hasil Impor Excel:</p>
                  <p>Berhasil diimpor: <strong>{importResult.importedCount}</strong> soal · Duplikat dilewati: <strong>{importResult.skippedDuplicates}</strong> · Gagal validasi: <strong>{importResult.failedCount}</strong></p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg">
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={importing || previewData.summary.validCount === 0}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {importing ? 'Menyimpan ke SQLite...' : `Konfirmasi & Impor Soal Valid`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteBankTarget)}
        onClose={() => setDeleteBankTarget(null)}
        onConfirm={handleDeleteBank}
        title="Hapus Bank Soal"
        message={`Hapus bank soal "${deleteBankTarget?.title}" beserta seluruh butir soal di dalamnya?`}
      />
      <ConfirmDialog
        open={Boolean(deleteQTarget)}
        onClose={() => setDeleteQTarget(null)}
        onConfirm={handleDeleteQuestion}
        title="Hapus Butir Soal"
        message={`Hapus soal kode "${deleteQTarget?.question_code}"?`}
      />
    </div>
  );
};
