import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Users, UserCheck, School, Layers, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import type { ClassRoom, Department, StudentRow, Subject, TeacherRow } from '../../types';

const PAGE_SIZE = 10;

function usePagination<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const sliced = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return { totalPages, safePage, sliced };
}

const PaginationBar: React.FC<{
  totalItems: number;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}> = ({ totalItems, page, totalPages, onPageChange }) => (
  <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
    <span className="tabular-nums">Total {totalItems} data · Halaman {page} dari {totalPages}</span>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

/* ======================== TEACHERS PAGE ======================== */
export const TeachersPage: React.FC<{ globalSearch: string }> = ({ globalSearch }) => {
  const { showToast } = useToast();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    nip: '',
    phone: '',
    email: '',
    specialization: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeacherRow | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ teachers: TeacherRow[] }>('/api/admin/teachers');
      setTeachers(res.teachers);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const query = (search || globalSearch).trim().toLowerCase();
  const filtered = useMemo(
    () =>
      teachers.filter(
        (t) =>
          !query ||
          t.full_name.toLowerCase().includes(query) ||
          t.username.toLowerCase().includes(query) ||
          t.nip.toLowerCase().includes(query) ||
          t.specialization.toLowerCase().includes(query)
      ),
    [teachers, query]
  );

  const { totalPages, safePage, sliced } = usePagination(filtered, page);

  const openAdd = () => {
    setEditing(null);
    setForm({ username: '', password: '', full_name: '', nip: '', phone: '', email: '', specialization: '', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (t: TeacherRow) => {
    setEditing(t);
    setForm({
      username: t.username,
      password: '',
      full_name: t.full_name,
      nip: t.nip,
      phone: t.phone,
      email: t.email,
      specialization: t.specialization,
      is_active: Boolean(t.is_active),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/admin/teachers/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        showToast('Data guru berhasil diperbarui.', 'success');
      } else {
        await apiFetch('/api/admin/teachers', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        showToast('Akun guru berhasil ditambahkan.', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/teachers/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Data guru berhasil dihapus.', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Manajemen Guru</h1>
          <p className="text-xs text-slate-500 mt-1">Kelola akun guru pengampu mata pelajaran dan pengawas ujian.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Tambah Guru
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, username, NIP..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat data guru...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<UserCheck className="w-6 h-6" />}
              title="Data guru tidak ditemukan"
              description="Tambahkan akun guru baru agar dapat membuat bank soal dan mengelola ujian."
              action={
                <button
                  type="button"
                  onClick={openAdd}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg"
                >
                  Tambah Guru Pertama
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">NIP</th>
                    <th className="py-3 px-4">Bidang / Mapel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sliced.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-semibold text-[#102B50]">{t.full_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{t.username}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">{t.nip || '-'}</td>
                      <td className="py-3 px-4 text-slate-600">{t.specialization || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${t.is_active ? 'text-[#16A36A]' : 'text-[#DC2626]'}`}>
                          {t.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 mr-1"
                          title="Edit Guru"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#DC2626] hover:bg-red-50"
                          title="Hapus Guru"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar totalItems={filtered.length} page={safePage} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Data Guru' : 'Tambah Akun Guru'}
        subtitle="Isi identitas guru dan kredensial login GHIFARI CBT."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login *</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi {editing ? '(Kosongkan jika tetap)' : '*'}
              </label>
              <input
                type="password"
                required={!editing}
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIP</label>
              <input
                type="text"
                value={form.nip}
                onChange={(e) => setForm({ ...form, nip: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bidang Keahlian / Mapel</label>
              <input
                type="text"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
          {editing && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-slate-300 text-[#2563EB]"
              />
              Akun Aktif (dapat login)
            </label>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan Data Guru'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Akun Guru"
        message={`Apakah Anda yakin ingin menghapus data guru "${deleteTarget?.full_name}"?`}
        confirmLabel="Hapus Guru"
      />
    </div>
  );
};

/* ======================== STUDENTS PAGE ======================== */
export const StudentsPage: React.FC<{ globalSearch: string }> = ({ globalSearch }) => {
  const { showToast } = useToast();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    nis: '',
    participant_number: '',
    class_id: '',
    department_id: '',
    gender: 'L' as 'L' | 'P',
    phone: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, refRes] = await Promise.all([
        apiFetch<{ students: StudentRow[] }>('/api/admin/students'),
        apiFetch<{ classes: ClassRoom[]; departments: Department[] }>('/api/admin/master/references'),
      ]);
      setStudents(sRes.students);
      setClasses(refRes.classes);
      setDepartments(refRes.departments);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const query = (search || globalSearch).trim().toLowerCase();
  const filtered = useMemo(
    () =>
      students.filter((s) => {
        if (classFilter && String(s.class_id) !== classFilter) return false;
        if (deptFilter && String(s.department_id) !== deptFilter) return false;
        if (!query) return true;
        return (
          s.full_name.toLowerCase().includes(query) ||
          s.nis.toLowerCase().includes(query) ||
          s.participant_number.toLowerCase().includes(query) ||
          s.username.toLowerCase().includes(query)
        );
      }),
    [students, classFilter, deptFilter, query]
  );

  const { totalPages, safePage, sliced } = usePagination(filtered, page);

  const openAdd = () => {
    setEditing(null);
    setForm({
      username: '',
      password: '',
      full_name: '',
      nis: '',
      participant_number: `CBT-2026-${String(students.length + 1).padStart(3, '0')}`,
      class_id: classes[0] ? String(classes[0].id) : '',
      department_id: classes[0]?.department_id ? String(classes[0].department_id) : '',
      gender: 'L',
      phone: '',
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (s: StudentRow) => {
    setEditing(s);
    setForm({
      username: s.username,
      password: '',
      full_name: s.full_name,
      nis: s.nis,
      participant_number: s.participant_number,
      class_id: s.class_id ? String(s.class_id) : '',
      department_id: s.department_id ? String(s.department_id) : '',
      gender: s.gender,
      phone: s.phone,
      is_active: Boolean(s.is_active),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        class_id: form.class_id ? Number(form.class_id) : null,
        department_id: form.department_id ? Number(form.department_id) : null,
      };
      if (editing) {
        await apiFetch(`/api/admin/students/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Data siswa berhasil diperbarui.', 'success');
      } else {
        await apiFetch('/api/admin/students', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Siswa baru berhasil ditambahkan.', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/students/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Data siswa berhasil dihapus.', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Manajemen Siswa & Peserta Ujian</h1>
          <p className="text-xs text-slate-500 mt-1">Kelola akun siswa, nomor peserta CBT, dan penempatan kelas.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Tambah Siswa
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, NIS, nomor peserta..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">Semua Jurusan</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat data siswa...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="Belum ada data siswa"
              description="Tambahkan peserta ujian siswa agar dapat login dan mengikuti ujian CBT."
              action={
                <button type="button" onClick={openAdd} className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg">
                  Tambah Siswa
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">No. Peserta</th>
                    <th className="py-3 px-4">NIS</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sliced.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-semibold text-[#102B50] whitespace-nowrap">{s.participant_number}</td>
                      <td className="py-3 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">{s.nis}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{s.full_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{s.username}</td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {s.class_name || '-'} {s.department_code ? `· ${s.department_code}` : ''}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${s.is_active ? 'text-[#16A36A]' : 'text-[#DC2626]'}`}>
                          {s.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 mr-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#DC2626] hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar totalItems={filtered.length} page={safePage} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
        subtitle="Lengkapi identitas siswa, kelas, dan akun login CBT."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIS *</label>
              <input
                type="text"
                required
                value={form.nis}
                onChange={(e) => setForm({ ...form, nis: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">No. Peserta CBT *</label>
              <input
                type="text"
                required
                value={form.participant_number}
                onChange={(e) => setForm({ ...form, participant_number: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username Login *</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi {editing ? '(Kosongkan jika tetap)' : '*'}
              </label>
              <input
                type="password"
                required={!editing}
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas</label>
              <select
                value={form.class_id}
                onChange={(e) => {
                  const selected = classes.find((c) => String(c.id) === e.target.value);
                  setForm({
                    ...form,
                    class_id: e.target.value,
                    department_id: selected?.department_id ? String(selected.department_id) : form.department_id,
                  });
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
              >
                <option value="">-- Pilih Kelas --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jurusan</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
              >
                <option value="">-- Pilih Jurusan --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>
          {editing && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-slate-300 text-[#2563EB]"
              />
              Akun Aktif
            </label>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Simpan Siswa'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Data Siswa"
        message={`Hapus akun siswa "${deleteTarget?.full_name}" (NIS ${deleteTarget?.nis})?`}
        confirmLabel="Hapus Siswa"
      />
    </div>
  );
};

/* ======================== CLASSES PAGE ======================== */
export const ClassesPage: React.FC<{ globalSearch: string }> = ({ globalSearch }) => {
  const { showToast } = useToast();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [form, setForm] = useState({ name: '', grade_level: 'XI', department_id: '', academic_year: '2026/2027' });
  const [deleteTarget, setDeleteTarget] = useState<ClassRoom | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([
        apiFetch<{ classes: ClassRoom[] }>('/api/admin/classes'),
        apiFetch<{ departments: Department[] }>('/api/admin/departments'),
      ]);
      setClasses(cRes.classes);
      setDepartments(dRes.departments);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const query = (search || globalSearch).trim().toLowerCase();
  const filtered = classes.filter(
    (c) => !query || c.name.toLowerCase().includes(query) || (c.department_name || '').toLowerCase().includes(query)
  );

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', grade_level: 'XI', department_id: departments[0] ? String(departments[0].id) : '', academic_year: '2026/2027' });
    setModalOpen(true);
  };

  const openEdit = (c: ClassRoom) => {
    setEditing(c);
    setForm({
      name: c.name,
      grade_level: c.grade_level,
      department_id: c.department_id ? String(c.department_id) : '',
      academic_year: c.academic_year,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, department_id: form.department_id ? Number(form.department_id) : null };
      if (editing) {
        await apiFetch(`/api/admin/classes/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Kelas berhasil diperbarui.', 'success');
      } else {
        await apiFetch('/api/admin/classes', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Kelas berhasil ditambahkan.', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/classes/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Kelas berhasil dihapus.', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Manajemen Kelas</h1>
          <p className="text-xs text-slate-500 mt-1">Atur rombongan belajar, tingkat kelas, dan tahun ajaran.</p>
        </div>
        <button type="button" onClick={openAdd} className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0">
          <Plus className="w-4 h-4" /> Tambah Kelas
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama kelas..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat data kelas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<School className="w-6 h-6" />} title="Belum ada kelas" description="Tambahkan kelas agar siswa dan ujian dapat dikelompokkan." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Nama Kelas</th>
                  <th className="py-3 px-4">Tingkat</th>
                  <th className="py-3 px-4">Jurusan</th>
                  <th className="py-3 px-4">Tahun Ajaran</th>
                  <th className="py-3 px-4 text-right">Jumlah Siswa</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-[#102B50]">{c.name}</td>
                    <td className="py-3 px-4 text-slate-700">Kelas {c.grade_level}</td>
                    <td className="py-3 px-4 text-slate-600">{c.department_code ? `${c.department_code} — ${c.department_name}` : 'Umum'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{c.academic_year}</td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums">{c.student_count ?? 0}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 mr-1"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setDeleteTarget(c)} className="p-1.5 rounded-lg text-slate-600 hover:text-[#DC2626] hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Kelas' : 'Tambah Kelas'} maxWidthClass="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kelas *</label>
            <input type="text" required placeholder="Contoh: XI TKJ 1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat *</label>
              <select value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="X">X</option>
                <option value="XI">XI</option>
                <option value="XII">XII</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
              <input type="text" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Jurusan</label>
            <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">-- Umum --</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg">Batal</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700">Simpan</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Hapus Kelas" message={`Hapus kelas "${deleteTarget?.name}"?`} />
    </div>
  );
};

/* ======================== DEPARTMENTS PAGE ======================== */
export const DepartmentsPage: React.FC<{ globalSearch: string }> = ({ globalSearch }) => {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ departments: Department[] }>('/api/admin/departments');
      setDepartments(res.departments);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const query = globalSearch.trim().toLowerCase();
  const filtered = departments.filter((d) => !query || d.code.toLowerCase().includes(query) || d.name.toLowerCase().includes(query));

  const openAdd = () => {
    setEditing(null);
    setForm({ code: '', name: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ code: d.code, name: d.name, description: d.description });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiFetch(`/api/admin/departments/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
        showToast('Jurusan berhasil diperbarui.', 'success');
      } else {
        await apiFetch('/api/admin/departments', { method: 'POST', body: JSON.stringify(form) });
        showToast('Jurusan berhasil ditambahkan.', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/departments/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Jurusan berhasil dihapus.', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Manajemen Jurusan / Kompetensi Keahlian</h1>
          <p className="text-xs text-slate-500 mt-1">Kelola program keahlian di SMK Al-Ghifari.</p>
        </div>
        <button type="button" onClick={openAdd} className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0">
          <Plus className="w-4 h-4" /> Tambah Jurusan
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat data jurusan...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<Layers className="w-6 h-6" />} title="Belum ada jurusan" description="Tambahkan jurusan seperti TKJ, RPL, atau AKL." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Jurusan</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-right">Kelas</th>
                  <th className="py-3 px-4 text-right">Siswa</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-[#2563EB]">{d.code}</td>
                    <td className="py-3 px-4 font-semibold text-[#102B50]">{d.name}</td>
                    <td className="py-3 px-4 text-slate-600">{d.description || '-'}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{d.class_count ?? 0}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{d.student_count ?? 0}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 mr-1"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setDeleteTarget(d)} className="p-1.5 rounded-lg text-slate-600 hover:text-[#DC2626] hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Jurusan' : 'Tambah Jurusan'} maxWidthClass="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Jurusan *</label>
            <input type="text" required placeholder="Contoh: TKJ" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Jurusan *</label>
            <input type="text" required placeholder="Teknik Komputer dan Jaringan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg">Batal</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700">Simpan</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Hapus Jurusan" message={`Hapus jurusan "${deleteTarget?.name}"?`} />
    </div>
  );
};

/* ======================== SUBJECTS PAGE ======================== */
export const SubjectsPage: React.FC<{ globalSearch: string }> = ({ globalSearch }) => {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ code: '', name: '', department_id: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, dRes] = await Promise.all([
        apiFetch<{ subjects: Subject[] }>('/api/admin/subjects'),
        apiFetch<{ departments: Department[] }>('/api/admin/departments'),
      ]);
      setSubjects(sRes.subjects);
      setDepartments(dRes.departments);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const query = (search || globalSearch).trim().toLowerCase();
  const filtered = subjects.filter((s) => !query || s.code.toLowerCase().includes(query) || s.name.toLowerCase().includes(query));

  const openAdd = () => {
    setEditing(null);
    setForm({ code: '', name: '', department_id: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({ code: s.code, name: s.name, department_id: s.department_id ? String(s.department_id) : '', description: s.description });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, department_id: form.department_id ? Number(form.department_id) : null };
      if (editing) {
        await apiFetch(`/api/admin/subjects/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Mata pelajaran berhasil diperbarui.', 'success');
      } else {
        await apiFetch('/api/admin/subjects', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Mata pelajaran berhasil ditambahkan.', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/subjects/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Mata pelajaran berhasil dihapus.', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Manajemen Mata Pelajaran</h1>
          <p className="text-xs text-slate-500 mt-1">Daftar mata pelajaran umum dan kejuruan untuk bank soal dan ujian.</p>
        </div>
        <button type="button" onClick={openAdd} className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0">
          <Plus className="w-4 h-4" /> Tambah Mata Pelajaran
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode atau nama mapel..." className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg" />
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat mata pelajaran...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<BookOpen className="w-6 h-6" />} title="Belum ada mata pelajaran" description="Tambahkan mata pelajaran terlebih dahulu." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Mata Pelajaran</th>
                  <th className="py-3 px-4">Jurusan</th>
                  <th className="py-3 px-4 text-right">Butir Soal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-[#2563EB]">{s.code}</td>
                    <td className="py-3 px-4 font-semibold text-[#102B50]">{s.name}</td>
                    <td className="py-3 px-4 text-slate-600">{s.department_code ? `${s.department_code} — ${s.department_name}` : 'Semua Jurusan'}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{s.question_count ?? 0}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 mr-1"><Pencil className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-lg text-slate-600 hover:text-[#DC2626] hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'} maxWidthClass="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Mapel *</label>
            <input type="text" required placeholder="Contoh: INF" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Mata Pelajaran *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Jurusan Terkait</label>
            <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Umum (Semua Jurusan)</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg">Batal</button>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700">Simpan</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Hapus Mata Pelajaran" message={`Hapus mata pelajaran "${deleteTarget?.name}"?`} />
    </div>
  );
};
