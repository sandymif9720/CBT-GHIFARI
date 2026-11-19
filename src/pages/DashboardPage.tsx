import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  School,
  BookOpen,
  FileSpreadsheet,
  ClipboardCheck,
  Activity,
  Award,
  ArrowUpRight,
  Wifi,
} from 'lucide-react';
import type { AuthUser } from '../types';
import { apiFetch } from '../utils/api';
import { StatCard } from '../components/ui/StatCard';
import type { NavKey } from '../layouts/DashboardLayout';

interface DashboardPageProps {
  user: AuthUser;
  onNavigate: (page: NavKey) => void;
  onNotificationsChange?: (n: { activeExams: number; pendingEssays: number }) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  onNavigate,
  onNotificationsChange,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/admin/dashboard')
      .then((res) => {
        setData(res);
        onNotificationsChange?.({
          activeExams: res.stats?.activeExams || 0,
          pendingEssays: res.stats?.pendingEssays || 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const isAdmin = user.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">
            {isAdmin ? 'Dashboard Administrator Sekolah' : 'Ruang Kerja Guru'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {user.school?.name || 'SMK Al-Ghifari'} · Tahun Ajaran {user.school?.academic_year || '2026/2027'} · Semester {user.school?.semester || 'Ganjil'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {data?.lanIps?.length > 0 && (
            <div className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-[#16A36A]" />
              <span>Alamat LAN Client:</span>
              <span className="font-mono font-semibold text-[#102B50]">http://{data.lanIps[0]}:3000</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onNavigate('exams')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            + Buat Ujian Baru
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      {isAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Siswa" value={stats.totalStudents ?? 0} hint="Peserta terdaftar aktif" icon={<Users className="w-5 h-5" />} accent="navy" />
          <StatCard label="Total Guru" value={stats.totalTeachers ?? 0} hint="Pengampu mata pelajaran" icon={<UserCheck className="w-5 h-5" />} accent="blue" />
          <StatCard label="Total Kelas" value={stats.totalClasses ?? 0} hint={`${stats.totalSubjects ?? 0} mata pelajaran`} icon={<School className="w-5 h-5" />} accent="navy" />
          <StatCard label="Bank Soal & Butir" value={stats.totalBanks ?? 0} hint={`${stats.totalQuestions ?? 0} total butir soal`} icon={<FileSpreadsheet className="w-5 h-5" />} accent="blue" />
          <StatCard label="Total Ujian" value={stats.totalExams ?? 0} hint="Seluruh jadwal ujian" icon={<ClipboardCheck className="w-5 h-5" />} accent="navy" />
          <StatCard label="Ujian Berlangsung" value={stats.activeExams ?? 0} hint="Aktif saat ini" icon={<Activity className="w-5 h-5" />} accent="green" />
          <StatCard label="Mata Pelajaran" value={stats.totalSubjects ?? 0} hint="Kurikulum SMK Al-Ghifari" icon={<BookOpen className="w-5 h-5" />} accent="blue" />
          <StatCard label="Esai Belum Dinilai" value={stats.pendingEssays ?? 0} hint="Menunggu koreksi guru" icon={<Award className="w-5 h-5" />} accent={stats.pendingEssays > 0 ? 'amber' : 'green'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Bank Soal Saya" value={stats.totalBanks ?? 0} hint={`${stats.totalQuestions ?? 0} total soal`} icon={<FileSpreadsheet className="w-5 h-5" />} accent="navy" />
          <StatCard label="Ujian Dibuat" value={stats.totalExams ?? 0} hint="Semua status ujian" icon={<ClipboardCheck className="w-5 h-5" />} accent="blue" />
          <StatCard label="Ujian Aktif" value={stats.activeExams ?? 0} hint="Sedang berlangsung" icon={<Activity className="w-5 h-5" />} accent="green" />
          <StatCard label="Total Peserta" value={stats.totalParticipants ?? 0} hint="Partisipasi ujian" icon={<Users className="w-5 h-5" />} accent="navy" />
          <StatCard label="Esai Belum Dinilai" value={stats.pendingEssays ?? 0} hint="Perlu koreksi manual" icon={<Award className="w-5 h-5" />} accent={stats.pendingEssays > 0 ? 'amber' : 'green'} />
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Ujian Aktif / Terjadwal */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#102B50]">Ujian Aktif & Terjadwal</h2>
              <p className="text-xs text-slate-500 mt-0.5">Pantau progres peserta secara langsung di jaringan lokal.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('monitoring')}
              className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              Buka Monitoring <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Nama Ujian</th>
                  <th className="py-2.5 px-4">Kelas</th>
                  <th className="py-2.5 px-4">Jadwal</th>
                  <th className="py-2.5 px-4 text-right">Peserta</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {(data?.runningExams || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Belum ada ujian berstatus Berlangsung atau Terjadwal.
                    </td>
                  </tr>
                ) : (
                  (data?.runningExams || []).map((ex: any) => (
                    <tr key={ex.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#102B50]">{ex.title}</p>
                        <p className="text-[11px] text-slate-500">{ex.subject_name}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{ex.class_name}</td>
                      <td className="py-3 px-4 text-slate-600 tabular-nums whitespace-nowrap">
                        {ex.exam_date} · {ex.start_time}–{ex.end_time}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-700 whitespace-nowrap">
                        {ex.active_participants} aktif / {ex.finished_participants} selesai
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            ex.status === 'Berlangsung' ? 'text-[#16A36A]' : 'text-[#2563EB]'
                          }`}
                        >
                          {ex.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Hasil Ujian Terbaru */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#102B50]">Hasil Ujian Terbaru</h2>
              <p className="text-xs text-slate-500 mt-0.5">Rekap nilai terbaru dari peserta.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('grading')}
              className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              Nilai Esai <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.recentResults || []).length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Belum ada hasil ujian tercatat.</p>
            ) : (
              (data?.recentResults || []).map((res: any) => (
                <div key={res.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#102B50] truncate">{res.student_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {res.class_name} · {res.exam_title}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {res.final_score !== null ? (
                      <>
                        <p className="text-sm font-bold text-[#102B50] tabular-nums">{res.final_score}</p>
                        <p className={`text-[11px] font-semibold ${res.passed ? 'text-[#16A36A]' : 'text-[#DC2626]'}`}>
                          {res.passed ? 'Lulus' : 'Belum Tuntas'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-amber-700 tabular-nums">PG: {res.pg_score}</p>
                        <p className="text-[11px] text-amber-600">Esai belum dinilai</p>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Aktivitas Terbaru */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#102B50]">Aktivitas Sistem Terbaru</h2>
            <p className="text-xs text-slate-500 mt-0.5">Catatan audit login, pembuatan ujian, dan penilaian.</p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap"
            >
              Lihat Log Lengkap
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Waktu</th>
                <th className="py-2.5 px-4">Pengguna</th>
                <th className="py-2.5 px-4">Aksi</th>
                <th className="py-2.5 px-4">Detail</th>
                <th className="py-2.5 px-4">IP Client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(data?.recentLogs || []).map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                    {log.created_at}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-[#102B50] whitespace-nowrap">
                    {log.username} <span className="text-slate-400">({log.role})</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-[#2563EB] whitespace-nowrap">{log.action}</td>
                  <td className="py-2.5 px-4 text-slate-700">{log.details}</td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
