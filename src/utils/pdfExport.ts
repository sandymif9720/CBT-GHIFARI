import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportExamReportPdf(report: {
  school?: { name?: string; npsn?: string; address?: string };
  exam: {
    title: string;
    subject_name: string;
    class_name: string;
    teacher_name: string;
    exam_date: string;
    passing_grade: number;
  };
  summary: {
    totalParticipants: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
    passRate: number;
  };
  ranking: Array<{
    rank: number;
    nis: string;
    participant_number: string;
    student_name: string;
    pg_correct: number;
    pg_total: number;
    pg_score: number;
    essay_score: number;
    essay_graded: number;
    final_score: number | null;
    passed: number | null;
  }>;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(16, 43, 80); // #102B50 Deep Navy
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Monogram G mark in PDF
  doc.setFillColor(37, 99, 235); // #2563EB Royal Blue
  doc.roundedRect(14, 6, 15, 15, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('G', 19.2, 16.2);

  doc.setFontSize(14);
  doc.text('GHIFARI CBT — LAPORAN HASIL UJIAN', 34, 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`${report.school?.name || 'SMK AL-GHIFARI'} · Smarter Examination. Better Education.`, 34, 18.5);
  if (report.school?.address) {
    doc.setFontSize(8);
    doc.text(report.school.address, 34, 23.5);
  }

  // Exam Metadata
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(report.exam.title, 14, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Mata Pelajaran : ${report.exam.subject_name}`, 14, 43);
  doc.text(`Kelas / Pengampu : ${report.exam.class_name} — ${report.exam.teacher_name}`, 14, 48);
  doc.text(`Tanggal Ujian : ${report.exam.exam_date}   |   KKM / Passing Grade : ${report.exam.passing_grade}`, 14, 53);

  // Summary strip
  doc.setFillColor(245, 247, 251);
  doc.rect(14, 57, pageWidth - 28, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`Peserta: ${report.summary.totalParticipants}`, 18, 65.5);
  doc.text(`Rata-rata: ${report.summary.avgScore}`, 52, 65.5);
  doc.text(`Tertinggi: ${report.summary.maxScore}`, 88, 65.5);
  doc.text(`Terendah: ${report.summary.minScore}`, 124, 65.5);
  doc.text(`Ketuntasan: ${report.summary.passRate}%`, 160, 65.5);

  const tableRows = report.ranking.map((r) => [
    String(r.rank),
    r.nis,
    r.student_name,
    `${r.pg_correct}/${r.pg_total}`,
    String(r.pg_score),
    r.essay_graded ? String(r.essay_score) : 'Belum Dinilai',
    r.final_score !== null ? String(r.final_score) : 'Menunggu',
    r.passed === 1 ? 'Lulus' : r.passed === 0 ? 'Tidak Lulus' : 'Belum Final',
  ]);

  autoTable(doc, {
    startY: 75,
    head: [['No', 'NIS', 'Nama Siswa', 'PG Benar', 'Nilai PG', 'Nilai Esai', 'Nilai Akhir', 'Status']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [16, 43, 80], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 24 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 17 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      7: { halign: 'center', cellWidth: 24 },
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `GHIFARI CBT — SMK AL-GHIFARI · Developed by MARGUMI STUDIO`,
        14,
        doc.internal.pageSize.getHeight() - 10
      );
      doc.text(
        `Halaman ${data.pageNumber} dari ${pageCount}`,
        pageWidth - 38,
        doc.internal.pageSize.getHeight() - 10
      );
    },
  });

  doc.save(`laporan-${report.exam.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
}
