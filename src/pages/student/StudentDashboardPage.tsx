import React, { useEffect, useState } from 'react';
import { Clock, Calendar, BookOpen, PlayCircle, CheckCircle2, Lock, LogOut, RefreshCw } from 'lucide-react';
import { GhifariLogo } from '../../components/GhifariLogo';
import { Modal } from '../../components/ui/Modal';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';
import type { AuthUser, StudentExamCard } from '../../types';

interface StudentDashboardPageProps {
  user: AuthUser;
  onStartExam: (examId: number) => void;
  onLogout: () => void;
}

export const StudentDashboardPage: React.FC<StudentDashboardPageProps> = ({
  user,
  onStartExam,
  onLogout,
}) => {
  const { showToast } = useToast();
  const [exams, setExams] = useState<StudentExamCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmExam, setConfirmExam] = useState<StudentExamCard | null>(null);
  const [starting, setStarting] = useState(false);

  const loadExams = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ exams: StudentExamCard[] }>('/api/student/exams');
      setExams(res.exams);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const handleConfirmStart = async () => {
    if (!confirmExam) return;
    setStarting(true);
    try {
      await apiFetch(`/api/student/exams/${confirmExam.id}/start`, { method: 'POST' });
      const id = confirmExam.id;
      setConfirmExam(null);
      onStartExam(id);
    } catch (err: any) {
      showToast(err.message, 'error');
      loadExams();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FB]">
      {/* Student Header */}
      <header className="bg-[#102B50] text-white px-4 sm:px-8 py-4 border-b border-white/10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <GhifariLogo size={38} variant="light" subtitle={user.school?.name || 'SMK AL-GHIFARI'} />

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white">{user.fullName}</p>
              <p className="text-xs text-blue-200 font-mono">
                {user.student?.class_name || '-'} · No. Peserta {user.student?.participant_number || '-'}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 space-y-6">
        {/* Student Identity Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">Portal Peserta Ujian</p>
            <h1 className="text-xl font-extrabold text-[#102B50] mt-0.5">Selamat Datang, {user.fullName}</h1>
            <p className="text-xs text-slate-500 mt-1">
              NIS {user.student?.nis || '-'} · Kelas {user.student?.class_name || '-'} · Jurusan {user.student?.department_name || '-'}
            </p>
          </div>
          <button
            type="button"
            onClick={loadExams}
            className="px-3.5 py-2 text-xs font-semibold text-[#102B50] bg-[#F5F7FB] hover:bg-slate-200/70 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 self-start sm:self-center whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang Jadwal
          </button>
        </div>

        {/* Exam Cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#102B50]">Daftar Ujian Kelas Anda</h2>

          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
              Memuat jadwal ujian...
            </div>
          ) : exams.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
              Belum ada ujian yang dijadwalkan untuk kelas Anda saat ini.
            </div>
          ) : (
            <div className="grid gap-4">
              {exams.map((ex) => {
                const isDone = ex.participantStatus === 'selesai' || ex.participantStatus === 'waktu_habis';
                const isResumable = ex.participantStatus === 'sedang_mengerjakan' || ex.participantStatus === 'terputus';

                return (
                  <div
                    key={ex.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-bold text-[#2563EB]">{ex.subjectCode}</span>
                        <span>·</span>
                        <span className="font-semibold text-slate-700">{ex.subjectName}</span>
                        <span>·</span>
                        <span>Pengampu: {ex.teacherName}</span>
                      </div>

                      <h3 className="text-base font-extrabold text-[#102B50]">{ex.title}</h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {ex.examDate} · {ex.startTime}–{ex.endTime}
                        </span>
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Durasi {ex.durationMinutes} menit
                        </span>
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          {ex.questionCount} soal · KKM {ex.passingGrade}
                        </span>
                      </div>

                      <p className={`text-xs font-semibold pt-1 ${ex.canStart ? 'text-[#16A36A]' : isDone ? 'text-[#2563EB]' : 'text-slate-500'}`}>
                        {ex.scheduleNote}
                      </p>

                      {isDone && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          {ex.showResult && ex.result ? (
                            <div className="flex flex-wrap items-center gap-5 text-xs">
                              <span>
                                PG Benar: <strong className="tabular-nums text-[#102B50]">{ex.result.pgCorrect}/{ex.result.pgTotal}</strong>
                              </span>
                              <span>
                                Nilai PG: <strong className="tabular-nums text-[#102B50]">{ex.result.pgScore}</strong>
                              </span>
                              <span>
                                Nilai Akhir:{' '}
                                {ex.result.finalScore !== null ? (
                                  <strong className="text-sm tabular-nums text-[#102B50]">{ex.result.finalScore}</strong>
                                ) : (
                                  <span className="text-amber-600 font-semibold">Menunggu Penilaian Esai</span>
                                )}
                              </span>
                              {ex.result.passed !== null && (
                                <span className={`font-bold ${ex.result.passed ? 'text-[#16A36A]' : 'text-[#DC2626]'}`}>
                                  {ex.result.passed ? 'LULUS' : 'TIDAK LULUS'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Hasil ujian disembunyikan oleh guru pengampu.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {ex.canStart ? (
                        <button
                          type="button"
                          onClick={() => (isResumable ? onStartExam(ex.id) : setConfirmExam(ex))}
                          className="w-full md:w-auto px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                        >
                          <PlayCircle className="w-4 h-4" />
                          {isResumable ? 'Lanjutkan Ujian' : 'Mulai Ujian'}
                        </button>
                      ) : isDone ? (
                        <div className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#16A36A]" /> Selesai
                        </div>
                      ) : (
                        <div className="px-4 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium inline-flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" /> Tidak Tersedia
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500">
        GHIFARI CBT · {user.school?.name || 'SMK AL-GHIFARI'} · <span className="font-semibold text-[#102B50]">Developed by MARGUMI STUDIO</span>
      </footer>

      {/* Start Exam Confirmation Modal */}
      <Modal
        open={Boolean(confirmExam)}
        onClose={() => setConfirmExam(null)}
        title="Konfirmasi Mulai Ujian"
        subtitle={confirmExam?.title}
        maxWidthClass="max-w-lg"
      >
        {confirmExam && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-[#F5F7FB] border border-slate-200 space-y-1.5">
              <p><strong>Mata Pelajaran:</strong> {confirmExam.subjectName}</p>
              <p><strong>Durasi Pengerjaan:</strong> {confirmExam.durationMinutes} menit (Timer dihitung oleh server)</p>
              <p><strong>Jumlah Soal:</strong> {confirmExam.questionCount} butir soal</p>
            </div>
            <div>
              <p className="font-bold text-[#102B50] mb-1">Petunjuk Ujian:</p>
              <p className="text-slate-600 leading-relaxed">{confirmExam.instructions}</p>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmExam(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={starting}
                onClick={handleConfirmStart}
                className="px-5 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg disabled:opacity-60"
              >
                {starting ? 'Mempersiapkan Soal...' : 'Mulai Kerjakan Sekarang'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
