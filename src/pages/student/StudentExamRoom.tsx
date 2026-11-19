import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  Send,
  CloudCheck,
  WifiOff,
} from 'lucide-react';
import { GhifariLogo } from '../../components/GhifariLogo';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';

interface ExamQuestionItem {
  number: number;
  id: number;
  questionCode: string;
  topic: string;
  questionType: 'PG' | 'ESAI';
  questionText: string;
  score: number;
  options: Array<{ displayLabel: string; optionKey: string; text: string }>;
}

interface StudentExamRoomProps {
  examId: number;
  onExitExam: () => void;
}

function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const StudentExamRoom: React.FC<StudentExamRoomProps> = ({ examId, onExitExam }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<ExamQuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<number, { answerText: string; isDoubtful: boolean }>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const essayDebounceRef = useRef<number | null>(null);
  const timeoutTriggeredRef = useRef(false);

  // Load session from server (survives browser refresh!)
  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/student/exams/${examId}/session`)
      .then((res) => {
        if (res.finished) {
          showToast(res.expired ? 'Waktu ujian telah habis.' : 'Ujian ini sudah diselesaikan.', 'info');
          onExitExam();
          return;
        }
        setSession(res);
        setQuestions(res.questions || []);
        setAnswers(res.answers || {});
        setRemainingSeconds(res.remainingSeconds || 0);
      })
      .catch((err) => {
        showToast(err.message || 'Gagal memuat sesi ujian.', 'error');
        onExitExam();
      })
      .finally(() => setLoading(false));
  }, [examId]);

  const submitFinish = async (isTimeout = false) => {
    if (finishing) return;
    setFinishing(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/student/exams/${examId}/finish`, {
        method: 'POST',
        body: JSON.stringify({ timeout: isTimeout }),
      });
      showToast(res.message, isTimeout ? 'info' : 'success');
      onExitExam();
    } catch (err: any) {
      showToast(err.message, 'error');
      setFinishing(false);
    }
  };

  // Server-synced countdown timer (1s tick + 15s server heartbeat)
  useEffect(() => {
    if (loading || questions.length === 0) return;

    const tick = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (!timeoutTriggeredRef.current) {
            timeoutTriggeredRef.current = true;
            submitFinish(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const heartbeat = window.setInterval(() => {
      apiFetch(`/api/student/exams/${examId}/heartbeat`, { method: 'POST' })
        .then((res) => {
          setSaveState((prev) => (prev === 'offline' ? 'saved' : prev));
          if (res.finished) {
            if (!timeoutTriggeredRef.current) {
              timeoutTriggeredRef.current = true;
              showToast('Waktu ujian berakhir berdasarkan waktu server.', 'info');
              onExitExam();
            }
          } else if (typeof res.remainingSeconds === 'number') {
            setRemainingSeconds(res.remainingSeconds);
          }
        })
        .catch(() => {
          setSaveState('offline');
        });
    }, 15000);

    return () => {
      clearInterval(tick);
      clearInterval(heartbeat);
    };
  }, [loading, questions.length, examId]);

  const persistAnswer = async (questionId: number, answerText: string, isDoubtful: boolean) => {
    setSaveState('saving');
    try {
      const res = await apiFetch<{ saved: boolean; remainingSeconds?: number }>(
        `/api/student/exams/${examId}/answer`,
        {
          method: 'POST',
          body: JSON.stringify({
            question_id: questionId,
            answer_text: answerText,
            is_doubtful: isDoubtful,
          }),
        }
      );
      setSaveState('saved');
      if (typeof res.remainingSeconds === 'number') {
        setRemainingSeconds(res.remainingSeconds);
      }
    } catch (err: any) {
      setSaveState('offline');
      if (err?.data?.expired && !timeoutTriggeredRef.current) {
        timeoutTriggeredRef.current = true;
        showToast('Waktu ujian telah habis.', 'info');
        onExitExam();
      }
    }
  };

  const handleSelectOption = (questionId: number, optionKey: string) => {
    const prev = answers[questionId] || { answerText: '', isDoubtful: false };
    const updated = { ...prev, answerText: optionKey };
    setAnswers((curr) => ({ ...curr, [questionId]: updated }));
    persistAnswer(questionId, updated.answerText, updated.isDoubtful);
  };

  const handleEssayChange = (questionId: number, text: string) => {
    const prev = answers[questionId] || { answerText: '', isDoubtful: false };
    const updated = { ...prev, answerText: text };
    setAnswers((curr) => ({ ...curr, [questionId]: updated }));

    if (essayDebounceRef.current) {
      clearTimeout(essayDebounceRef.current);
    }
    setSaveState('saving');
    essayDebounceRef.current = window.setTimeout(() => {
      persistAnswer(questionId, text, updated.isDoubtful);
    }, 1000);
  };

  const handleToggleDoubtful = (questionId: number) => {
    const prev = answers[questionId] || { answerText: '', isDoubtful: false };
    const updated = { ...prev, isDoubtful: !prev.isDoubtful };
    setAnswers((curr) => ({ ...curr, [questionId]: updated }));
    persistAnswer(questionId, updated.answerText, updated.isDoubtful);
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200 px-8 py-6 text-center">
          <p className="text-sm font-bold text-[#102B50]">Memuat Ruang Ujian GHIFARI CBT...</p>
          <p className="text-xs text-slate-500 mt-1">Menyinkronkan soal dan waktu server.</p>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const currentAns = currentQ ? answers[currentQ.id] || { answerText: '', isDoubtful: false } : { answerText: '', isDoubtful: false };

  const answeredCount = questions.filter((q) => (answers[q.id]?.answerText || '').trim().length > 0).length;
  const doubtfulCount = questions.filter((q) => answers[q.id]?.isDoubtful).length;
  const unansweredCount = questions.length - answeredCount;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const isTimeLow = remainingSeconds <= 300;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FB]">
      {/* Focused Exam Header */}
      <header className="sticky top-0 z-30 bg-[#102B50] text-white px-4 sm:px-6 py-3 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <GhifariLogo size={34} variant="light" showText={false} />
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white truncate">{session.exam.title}</p>
              <p className="text-[11px] text-blue-200 truncate">
                {session.exam.subject_name} · {session.student.fullName} ({session.student.participantNumber})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Save Status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/10">
              {saveState === 'offline' ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-amber-200">Koneksi terputus</span>
                </>
              ) : saveState === 'saving' ? (
                <span className="text-blue-200">Menyimpan...</span>
              ) : (
                <>
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-200">Tersimpan</span>
                </>
              )}
            </div>

            {/* Server Countdown Timer */}
            <div
              className={`px-3.5 py-1.5 rounded-lg font-mono text-sm font-bold tabular-nums flex items-center gap-2 ${
                isTimeLow ? 'bg-[#DC2626] text-white' : 'bg-[#2563EB] text-white'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Exam Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Active Question */}
        {currentQ && (
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 flex flex-col">
            {/* Question Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-[#102B50] text-sm">
                  Soal No. {currentQ.number} dari {questions.length}
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-[#2563EB]">
                  {currentQ.questionType === 'PG' ? 'Pilihan Ganda' : 'Esai'}
                </span>
                {currentQ.topic && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">{currentQ.topic}</span>
                  </>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-500 tabular-nums">Bobot: {currentQ.score}</span>
            </div>

            {/* Question Stem & Inputs */}
            <div className="p-6 space-y-6 flex-1">
              <p className="text-base font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                {currentQ.questionText}
              </p>

              {currentQ.questionType === 'PG' ? (
                <div className="space-y-3">
                  {currentQ.options.map((opt) => {
                    const selected = currentAns.answerText === opt.optionKey;
                    return (
                      <button
                        key={opt.optionKey}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, opt.optionKey)}
                        className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3.5 ${
                          selected
                            ? 'bg-blue-50/80 border-[#2563EB] text-[#102B50]'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                            selected ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-[#102B50]'
                          }`}
                        >
                          {opt.displayLabel}
                        </span>
                        <span className="text-sm leading-relaxed pt-0.5">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Tuliskan jawaban uraian Anda pada kotak di bawah ini (tersimpan otomatis):
                  </label>
                  <textarea
                    rows={8}
                    value={currentAns.answerText}
                    onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                    onBlur={(e) => persistAnswer(currentQ.id, e.target.value, currentAns.isDoubtful)}
                    placeholder="Ketik jawaban esai Anda di sini..."
                    className="w-full p-4 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Bottom Navigation */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/60 rounded-b-xl flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="px-4 py-2 text-xs font-semibold text-[#102B50] bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => handleToggleDoubtful(currentQ.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  currentAns.isDoubtful
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {currentAns.isDoubtful ? 'Ragu-ragu (Aktif)' : 'Tandai Ragu-ragu'}
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  Berikutnya <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmFinishOpen(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#16A36A] hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" /> Selesai Ujian
                </button>
              )}
            </div>
          </div>
        )}

        {/* Right: Question Map & Progress */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#102B50]">Progres Pengerjaan</span>
              <span className="font-mono font-bold text-[#2563EB] tabular-nums">
                {answeredCount}/{questions.length} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#16A36A] transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="pt-2">
              <p className="text-xs font-bold text-[#102B50] mb-3">Navigasi Nomor Soal</p>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const hasAnswer = Boolean(ans?.answerText && ans.answerText.trim().length > 0);
                  const isDoubtful = Boolean(ans?.isDoubtful);
                  const isCurrent = idx === currentIdx;

                  let style = 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50';
                  if (isDoubtful) {
                    style = 'bg-amber-500 border-amber-500 text-white';
                  } else if (hasAnswer) {
                    style = 'bg-[#16A36A] border-[#16A36A] text-white';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`h-10 rounded-lg border text-xs font-mono font-bold tabular-nums transition-all ${style} ${
                        isCurrent ? 'ring-2 ring-[#2563EB] ring-offset-1' : ''
                      }`}
                    >
                      {q.number}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#16A36A] shrink-0" />
                <span>Sudah Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500 shrink-0" />
                <span>Ragu-ragu ({doubtfulCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-slate-300 bg-white shrink-0" />
                <span>Belum Dijawab ({unansweredCount})</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmFinishOpen(true)}
              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#102B50] hover:bg-slate-800 rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Akhiri & Kumpulkan Ujian
            </button>
          </div>
        </aside>
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 py-3 text-center text-xs text-slate-500">
        GHIFARI CBT · SMK AL-GHIFARI · <span className="font-semibold text-[#102B50]">Developed by MARGUMI STUDIO</span>
      </footer>

      <ConfirmDialog
        open={confirmFinishOpen}
        onClose={() => setConfirmFinishOpen(false)}
        onConfirm={() => submitFinish(false)}
        loading={finishing}
        variant="primary"
        title="Konfirmasi Selesai Ujian"
        message={`Anda telah menjawab ${answeredCount} dari ${questions.length} soal (${doubtfulCount} ditandai ragu-ragu, ${unansweredCount} belum dijawab). Setelah dikumpulkan, Anda tidak dapat mengubah jawaban kembali.`}
        confirmLabel="Ya, Kumpulkan Jawaban"
      />
    </div>
  );
};
