import React, { useEffect, useState } from 'react';
import { RefreshCw, Activity, WifiOff, CheckCircle2, Clock, Eye, StopCircle } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { StatCard } from '../../components/ui/StatCard';
import type { Exam } from '../../types';

interface MonitoringPageProps {
  initialExamId?: number | null;
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const MonitoringPage: React.FC<MonitoringPageProps> = ({ initialExamId }) => {
  const { showToast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId ? String(initialExamId) : '');
  const [monitoring, setMonitoring] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [detailParticipant, setDetailParticipant] = useState<any>(null);
  const [forceFinishTarget, setForceFinishTarget] = useState<any>(null);

  useEffect(() => {
    apiFetch<{ exams: Exam[] }>('/api/exams')
      .then((res) => {
        setExams(res.exams);
        if (!selectedExamId && res.exams.length > 0) {
          const active = res.exams.find((e) => e.status === 'Berlangsung') || res.exams[0];
          setSelectedExamId(String(active.id));
        }
      })
      .catch((err) => showToast(err.message, 'error'));
  }, []);

  useEffect(() => {
    if (initialExamId) setSelectedExamId(String(initialExamId));
  }, [initialExamId]);

  const loadMonitoring = async (silent = false) => {
    if (!selectedExamId) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch(`/api/exams/${selectedExamId}/monitoring`);
      setMonitoring(res);
    } catch (err: any) {
      if (!silent) showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitoring();
  }, [selectedExamId]);

  useEffect(() => {
    if (!autoRefresh || !selectedExamId) return;
    const timer = setInterval(() => {
      loadMonitoring(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, selectedExamId]);

  const handleForceFinish = async () => {
    if (!forceFinishTarget?.participantId) return;
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/exams/${selectedExamId}/force-finish/${forceFinishTarget.participantId}`,
        { method: 'POST' }
      );
      showToast(res.message, 'success');
      setForceFinishTarget(null);
      loadMonitoring();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const participants = monitoring?.participants || [];
  const countActive = participants.filter((p: any) => p.status === 'sedang_mengerjakan').length;
  const countDisconnected = participants.filter((p: any) => p.status === 'terputus').length;
  const countFinished = participants.filter((p: any) => p.status === 'selesai').length;
  const countTimeout = participants.filter((p: any) => p.status === 'waktu_habis').length;

  const renderStatus = (status: string) => {
    switch (status) {
      case 'sedang_mengerjakan':
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#16A36A]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#16A36A] shrink-0" />
            Sedang Mengerjakan
          </span>
        );
      case 'terputus':
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" />
            Koneksi Terputus
          </span>
        );
      case 'selesai':
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#2563EB]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB] shrink-0" />
            Sudah Mengumpulkan
          </span>
        );
      case 'waktu_habis':
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#DC2626]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#DC2626] shrink-0" />
            Waktu Habis
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 shrink-0" />
            Belum Mulai
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Monitoring Peserta Ujian</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pantau status koneksi, sisa waktu server, dan progres jawaban setiap komputer peserta secara real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-[#102B50] min-w-[260px]"
          >
            <option value="">-- Pilih Ujian --</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.class_name} · {ex.status})
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 text-[#2563EB]"
            />
            Auto-refresh 5 dtk
          </label>

          <button
            type="button"
            onClick={() => loadMonitoring()}
            className="px-3.5 py-2 text-xs font-semibold text-[#102B50] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Segarkan
          </button>
        </div>
      </div>

      {/* Status Legend & Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sedang Mengerjakan (Hijau)" value={countActive} icon={<Activity className="w-5 h-5" />} accent="green" />
        <StatCard label="Koneksi Terputus (Kuning)" value={countDisconnected} icon={<WifiOff className="w-5 h-5" />} accent="amber" />
        <StatCard label="Sudah Mengumpulkan (Biru)" value={countFinished} icon={<CheckCircle2 className="w-5 h-5" />} accent="blue" />
        <StatCard label="Waktu Habis (Merah)" value={countTimeout} icon={<Clock className="w-5 h-5" />} accent="red" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat data monitoring peserta...</div>
        ) : participants.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Tidak ada siswa terdaftar pada kelas ujian ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">No. Peserta</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Status Ujian</th>
                  <th className="py-3 px-4">Waktu Mulai</th>
                  <th className="py-3 px-4 text-right">Sisa Waktu</th>
                  <th className="py-3 px-4 text-right">Terjawab / Belum</th>
                  <th className="py-3 px-4">Koneksi Terakhir</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {participants.map((p: any) => (
                  <tr key={p.studentId} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-semibold text-[#102B50] whitespace-nowrap">
                      {p.participantNumber}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{p.fullName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">NIS {p.nis} · {p.ipAddress || '-'}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{renderStatus(p.status)}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                      {p.startedAt || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#102B50] tabular-nums whitespace-nowrap">
                      {p.participantId ? formatSeconds(p.remainingSeconds) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums whitespace-nowrap">
                      <span className="font-bold text-[#16A36A]">{p.answeredCount}</span>
                      <span className="text-slate-400"> / </span>
                      <span className="font-semibold text-slate-600">{p.unansweredCount}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {p.submittedAt ? `Submit: ${p.submittedAt}` : p.lastSeenAt || '-'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailParticipant(p)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#102B50] hover:bg-slate-100 inline-flex items-center gap-1 mr-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detail
                      </button>
                      {(p.status === 'sedang_mengerjakan' || p.status === 'terputus') && p.participantId && (
                        <button
                          type="button"
                          onClick={() => setForceFinishTarget(p)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#DC2626] hover:bg-red-50 inline-flex items-center gap-1"
                        >
                          <StopCircle className="w-3.5 h-3.5" /> Akhiri
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail Aktivitas Peserta */}
      <Modal
        open={Boolean(detailParticipant)}
        onClose={() => setDetailParticipant(null)}
        title={`Detail Aktivitas: ${detailParticipant?.fullName || ''}`}
        subtitle={`No. Peserta ${detailParticipant?.participantNumber || ''} · IP ${detailParticipant?.ipAddress || '-'}`}
        maxWidthClass="max-w-lg"
      >
        {detailParticipant && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#F5F7FB] border border-slate-200">
              <div>
                <p className="text-slate-500">Status Saat Ini</p>
                <div className="mt-1">{renderStatus(detailParticipant.status)}</div>
              </div>
              <div>
                <p className="text-slate-500">Progres Soal</p>
                <p className="mt-1 font-bold text-[#102B50] tabular-nums">
                  {detailParticipant.answeredCount} terjawab dari {detailParticipant.totalQuestions} soal
                </p>
              </div>
              <div>
                <p className="text-slate-500">Waktu Mulai</p>
                <p className="mt-1 font-mono">{detailParticipant.startedAt || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Waktu Submit</p>
                <p className="mt-1 font-mono">{detailParticipant.submittedAt || '-'}</p>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-[#102B50] mb-2">Log Aktivitas Terbaru Peserta</h4>
              {(detailParticipant.recentActivity || []).length === 0 ? (
                <p className="text-slate-500 py-3">Belum ada catatan aktivitas.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {detailParticipant.recentActivity.map((act: any, i: number) => (
                    <div key={i} className="p-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono font-bold text-[#2563EB]">{act.action}</span>
                        <span className="font-mono text-slate-400">{act.created_at}</span>
                      </div>
                      <p className="text-slate-700 mt-0.5">{act.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(forceFinishTarget)}
        onClose={() => setForceFinishTarget(null)}
        onConfirm={handleForceFinish}
        title="Akhiri Paksa Sesi Ujian"
        message={`Apakah Anda yakin ingin mengakhiri paksa ujian milik "${forceFinishTarget?.fullName}"? Jawaban terakhir yang sudah tersimpan di server akan langsung dinilai.`}
        confirmLabel="Akhiri Sesi Peserta"
      />
    </div>
  );
};
