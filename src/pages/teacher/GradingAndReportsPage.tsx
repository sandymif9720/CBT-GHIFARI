import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Clock, FileSpreadsheet, FileText, Save, BarChart3 } from 'lucide-react';
import { apiFetch, downloadFile } from '../../utils/api';
import { exportExamReportPdf } from '../../utils/pdfExport';
import { useToast } from '../../components/ui/Toast';
import { StatCard } from '../../components/ui/StatCard';
import type { ClassRoom, Department, Exam, Subject } from '../../types';

interface GradingAndReportsPageProps {
  mode: 'grading' | 'reports';
  initialExamId?: number | null;
}

export const GradingAndReportsPage: React.FC<GradingAndReportsPageProps> = ({
  mode,
  initialExamId,
}) => {
  const { showToast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Report Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId ? String(initialExamId) : '');
  const [gradingData, setGradingData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Essay edit drafts keyed by grade_id
  const [essayDrafts, setEssayDrafts] = useState<Record<number, { score: string; feedback: string }>>({});
  const [savingGradeId, setSavingGradeId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ exams: Exam[] }>('/api/exams'),
      apiFetch<{ classes: ClassRoom[]; departments: Department[]; subjects: Subject[] }>('/api/admin/master/references'),
    ])
      .then(([exRes, refRes]) => {
        setExams(exRes.exams);
        setClasses(refRes.classes);
        setDepartments(refRes.departments);
        setSubjects(refRes.subjects);
        if (!selectedExamId && exRes.exams.length > 0) {
          const preferred =
            exRes.exams.find((e) => e.status === 'Selesai') ||
            exRes.exams.find((e) => e.status === 'Berlangsung') ||
            exRes.exams[0];
          setSelectedExamId(String(preferred.id));
        }
      })
      .catch((err) => showToast(err.message, 'error'));
  }, []);

  useEffect(() => {
    if (initialExamId) setSelectedExamId(String(initialExamId));
  }, [initialExamId]);

  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      if (filterDate && e.exam_date !== filterDate) return false;
      if (filterClass && String(e.class_id) !== filterClass) return false;
      if (filterDept && String(e.department_id) !== filterDept) return false;
      if (filterSubject && String(e.subject_id) !== filterSubject) return false;
      return true;
    });
  }, [exams, filterDate, filterClass, filterDept, filterSubject]);

  const loadData = async () => {
    if (!selectedExamId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (mode === 'grading') {
        const res = await apiFetch(`/api/exams/${selectedExamId}/grading`);
        setGradingData(res);
        const drafts: Record<number, { score: string; feedback: string }> = {};
        for (const e of res.essays || []) {
          drafts[e.grade_id] = { score: String(e.score), feedback: e.feedback || '' };
        }
        setEssayDrafts(drafts);
      } else {
        const res = await apiFetch(`/api/exams/${selectedExamId}/report`);
        setReportData(res);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedExamId, mode]);

  const handleSaveEssayGrade = async (essay: any) => {
    const draft = essayDrafts[essay.grade_id];
    if (!draft) return;
    setSavingGradeId(essay.grade_id);
    try {
      const res = await apiFetch<{ message: string }>(`/api/exams/${selectedExamId}/grade-essay`, {
        method: 'POST',
        body: JSON.stringify({
          grade_id: essay.grade_id,
          score: Number(draft.score),
          feedback: draft.feedback,
        }),
      });
      showToast(res.message, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingGradeId(null);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedExamId) return;
    try {
      await downloadFile(`/api/exams/${selectedExamId}/export-excel`, `laporan-ujian-${selectedExamId}.xlsx`);
      showToast('Laporan Excel berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleExportPdf = () => {
    if (!reportData) return;
    try {
      exportExamReportPdf(reportData);
      showToast('Laporan PDF berhasil dibuat.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengekspor PDF.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">
            {mode === 'grading' ? 'Hasil Ujian & Penilaian Esai' : 'Laporan & Analitik Ujian'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'grading'
              ? 'Koreksi PG dilakukan otomatis. Nilai akhir siswa baru dinyatakan final setelah seluruh esai dinilai guru.'
              : 'Analisis statistik nilai, peringkat kelas, analisis butir soal, dan ekspor Excel / PDF.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-[#102B50] min-w-[260px]"
          >
            <option value="">-- Pilih Ujian --</option>
            {filteredExams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.class_name})
              </option>
            ))}
          </select>

          {mode === 'reports' && reportData && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 text-xs font-semibold text-[#102B50] bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#16A36A]" /> Export Excel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#102B50] hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileText className="w-4 h-4" /> Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters Bar in Reports Mode */}
      {mode === 'reports' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-[#102B50]">Filter Laporan:</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
          />
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">Semua Kelas</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">Semua Jurusan</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white">
            <option value="">Semua Mapel</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {(filterDate || filterClass || filterDept || filterSubject) && (
            <button
              type="button"
              onClick={() => {
                setFilterDate('');
                setFilterClass('');
                setFilterDept('');
                setFilterSubject('');
              }}
              className="text-xs font-semibold text-[#2563EB] hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-10 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
          Memuat data penilaian dan analitik...
        </div>
      ) : mode === 'grading' && gradingData ? (
        <div className="space-y-6">
          {/* Participant Score Summary Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#102B50]">Rekap Nilai Peserta — {gradingData.exam.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bobot PG {gradingData.exam.pg_weight}% · Bobot Esai {gradingData.exam.essay_weight}% · KKM {gradingData.exam.passing_grade}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">No. Peserta</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4 text-right">PG Benar</th>
                    <th className="py-3 px-4 text-right">Nilai PG</th>
                    <th className="py-3 px-4 text-right">Nilai Esai</th>
                    <th className="py-3 px-4 text-right">Nilai Akhir</th>
                    <th className="py-3 px-4">Status Kelulusan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {(gradingData.participants || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">Belum ada peserta yang mengerjakan ujian ini.</td>
                    </tr>
                  ) : (
                    gradingData.participants.map((p: any) => (
                      <tr key={p.participant_id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono text-slate-600">{p.participant_number}</td>
                        <td className="py-3 px-4 font-semibold text-[#102B50]">{p.full_name}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{p.pg_correct ?? 0}/{p.pg_total ?? 0}</td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums">{p.pg_score ?? 0}</td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {p.essay_graded ? (
                            <span className="font-semibold">{p.essay_score}</span>
                          ) : (
                            <span className="text-amber-600 font-medium">Belum Dinilai</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#102B50] tabular-nums">
                          {p.final_score !== null && p.final_score !== undefined ? p.final_score : 'Menunggu Esai'}
                        </td>
                        <td className="py-3 px-4">
                          {p.passed === 1 ? (
                            <span className="font-bold text-[#16A36A]">Lulus (Tuntas)</span>
                          ) : p.passed === 0 ? (
                            <span className="font-bold text-[#DC2626]">Tidak Lulus</span>
                          ) : (
                            <span className="font-semibold text-amber-600">Belum Final</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Essay Grading Workspace */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-[#102B50]">Lembar Penilaian Jawaban Esai</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Berikan skor dan catatan umpan balik untuk setiap jawaban uraian siswa.
              </p>
            </div>
            <div className="divide-y divide-slate-200">
              {(gradingData.essays || []).length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-500">Tidak ada soal esai pada ujian ini atau belum ada jawaban masuk.</p>
              ) : (
                gradingData.essays.map((es: any) => {
                  const draft = essayDrafts[es.grade_id] || { score: '0', feedback: '' };
                  const isGraded = es.status === 'sudah_dinilai';
                  return (
                    <div key={es.grade_id} className="p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#102B50]">{es.student_name}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-slate-500">{es.participant_number}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-[#2563EB] font-semibold">{es.question_code}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 font-semibold ${isGraded ? 'text-[#16A36A]' : 'text-amber-600'}`}>
                          {isGraded ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {isGraded ? 'Sudah Dinilai' : 'Belum Dinilai'}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-700">Pertanyaan: {es.question_text}</p>

                      <div className="p-3.5 rounded-lg bg-[#F5F7FB] border border-slate-200 text-sm text-slate-900 whitespace-pre-wrap">
                        {es.answer_text || <span className="italic text-slate-400">(Siswa tidak mengisi jawaban)</span>}
                      </div>

                      <div className="grid sm:grid-cols-12 gap-3 items-end pt-1">
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Skor (Maks: {es.max_score})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={es.max_score}
                            step="0.5"
                            value={draft.score}
                            onChange={(e) =>
                              setEssayDrafts((prev) => ({
                                ...prev,
                                [es.grade_id]: { ...draft, score: e.target.value },
                              }))
                            }
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums font-bold"
                          />
                        </div>
                        <div className="sm:col-span-7">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Catatan / Feedback Guru
                          </label>
                          <input
                            type="text"
                            value={draft.feedback}
                            onChange={(e) =>
                              setEssayDrafts((prev) => ({
                                ...prev,
                                [es.grade_id]: { ...draft, feedback: e.target.value },
                              }))
                            }
                            placeholder="Opsional: tulis komentar atau koreksi untuk siswa..."
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            disabled={savingGradeId === es.grade_id}
                            onClick={() => handleSaveEssayGrade(es)}
                            className="w-full py-2 px-3 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingGradeId === es.grade_id ? 'Simpan...' : 'Simpan'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : mode === 'reports' && reportData ? (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Rata-Rata Kelas" value={reportData.summary.avgScore} hint={`${reportData.summary.finalizedCount} nilai final`} icon={<BarChart3 className="w-5 h-5" />} accent="navy" />
            <StatCard label="Nilai Tertinggi" value={reportData.summary.maxScore} icon={<Award className="w-5 h-5" />} accent="green" />
            <StatCard label="Nilai Terendah" value={reportData.summary.minScore} icon={<Clock className="w-5 h-5" />} accent="amber" />
            <StatCard label="Persentase Kelulusan" value={`${reportData.summary.passRate}%`} hint={`${reportData.summary.passedCount} siswa tuntas KKM ${reportData.exam.passing_grade}`} icon={<CheckCircle2 className="w-5 h-5" />} accent="blue" />
          </div>

          {/* Ranking Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#102B50]">Peringkat & Hasil Nilai Per Siswa</h2>
              <span className="text-xs text-slate-500">KKM: {reportData.exam.passing_grade}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Peringkat</th>
                    <th className="py-3 px-4">NIS</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4 text-right">PG Benar</th>
                    <th className="py-3 px-4 text-right">Nilai PG</th>
                    <th className="py-3 px-4 text-right">Nilai Esai</th>
                    <th className="py-3 px-4 text-right">Nilai Akhir</th>
                    <th className="py-3 px-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {reportData.ranking.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">Belum ada data nilai untuk ujian ini.</td>
                    </tr>
                  ) : (
                    reportData.ranking.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono font-bold text-[#102B50] tabular-nums">#{r.rank}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{r.nis}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{r.student_name}</td>
                        <td className="py-3 px-4 text-slate-600">{r.class_name}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{r.pg_correct}/{r.pg_total}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{r.pg_score}</td>
                        <td className="py-3 px-4 text-right tabular-nums">{r.essay_graded ? r.essay_score : 'Belum Dinilai'}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#102B50] tabular-nums">
                          {r.final_score !== null ? r.final_score : 'Menunggu Esai'}
                        </td>
                        <td className="py-3 px-4">
                          {r.passed === 1 ? (
                            <span className="font-bold text-[#16A36A]">Lulus</span>
                          ) : r.passed === 0 ? (
                            <span className="font-bold text-[#DC2626]">Tidak Lulus</span>
                          ) : (
                            <span className="font-semibold text-amber-600">Belum Final</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Item Analysis Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-[#102B50]">Analisis Butir Soal</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tingkat keberhasilan peserta menjawab setiap soal.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">No</th>
                    <th className="py-3 px-4">Kode</th>
                    <th className="py-3 px-4">Tipe</th>
                    <th className="py-3 px-4">Pertanyaan</th>
                    <th className="py-3 px-4 text-right">Dijawab</th>
                    <th className="py-3 px-4 text-right">Benar (PG)</th>
                    <th className="py-3 px-4 text-right">Ketuntasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {reportData.itemAnalysis.map((it: any) => (
                    <tr key={it.questionId} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono tabular-nums">{it.no}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#2563EB]">{it.questionCode}</td>
                      <td className="py-3 px-4 font-semibold">{it.questionType}</td>
                      <td className="py-3 px-4 max-w-md truncate">{it.questionText}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{it.totalAnswered}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{it.questionType === 'PG' ? it.correctCount : '-'}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        {it.correctRate !== null ? `${it.correctRate}%` : `Rata-rata ${it.avgScore}/${it.maxScore}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
          Pilih ujian untuk melihat data penilaian atau laporan.
        </div>
      )}
    </div>
  );
};
