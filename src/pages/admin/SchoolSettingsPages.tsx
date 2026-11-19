import React, { useEffect, useState } from 'react';
import { Building2, Save, DatabaseBackup, Download, Upload, ShieldAlert, History, Settings, Wifi } from 'lucide-react';
import { apiFetch, downloadFile, getStoredToken } from '../../utils/api';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { School } from '../../types';

/* ======================== SCHOOL IDENTITY PAGE ======================== */
export const SchoolIdentityPage: React.FC = () => {
  const { showToast } = useToast();
  const [school, setSchool] = useState<School>({
    id: 1,
    name: 'SMK Al-Ghifari',
    npsn: '',
    address: '',
    phone: '',
    email: '',
    principal_name: '',
    academic_year: '2026/2027',
    semester: 'Ganjil',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ school: School }>('/api/admin/school')
      .then((res) => {
        if (res.school) setSchool(res.school);
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ school: School; message: string }>('/api/admin/school', {
        method: 'PUT',
        body: JSON.stringify(school),
      });
      if (res.school) setSchool(res.school);
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs text-slate-500">Memuat identitas sekolah...</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-extrabold text-[#102B50]">Identitas Sekolah</h1>
        <p className="text-xs text-slate-500 mt-1">Data resmi institusi akan tampil pada header laporan PDF, Excel, dan halaman login.</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-[#102B50]/10 text-[#102B50] flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#102B50]">{school.name}</h2>
            <p className="text-xs text-slate-500">NPSN: {school.npsn || '-'}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Sekolah *</label>
            <input type="text" required value={school.name} onChange={(e) => setSchool({ ...school, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">NPSN</label>
            <input type="text" value={school.npsn} onChange={(e) => setSchool({ ...school, npsn: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kepala Sekolah</label>
            <input type="text" value={school.principal_name} onChange={(e) => setSchool({ ...school, principal_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Sekolah</label>
            <input type="email" value={school.email} onChange={(e) => setSchool({ ...school, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon</label>
            <input type="text" value={school.phone} onChange={(e) => setSchool({ ...school, phone: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
              <input type="text" value={school.academic_year} onChange={(e) => setSchool({ ...school, academic_year: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
              <select value={school.semester} onChange={(e) => setSchool({ ...school, semester: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
          <textarea rows={3} value={school.address} onChange={(e) => setSchool({ ...school, address: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button type="submit" disabled={saving} className="px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" />
            {saving ? 'Menyimpan...' : 'Simpan Identitas Sekolah'}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ======================== SETTINGS & AUDIT LOGS PAGE ======================== */
export const SettingsAndLogsPage: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'settings' | 'logs'>('settings');
  const [settings, setSettings] = useState<Array<{ key: string; value: string; description: string }>>([]);
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    try {
      const [setRes, logRes] = await Promise.all([
        apiFetch<{ settings: any[]; lanIps: string[] }>('/api/admin/settings'),
        apiFetch<{ logs: any[] }>(`/api/admin/logs${roleFilter ? `?role=${roleFilter}` : ''}`),
      ]);
      setSettings(setRes.settings);
      setLanIps(setRes.lanIps || []);
      setLogs(logRes.logs);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadAll();
  }, [roleFilter]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      });
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#102B50]">Pengaturan Sistem & Audit Log</h1>
          <p className="text-xs text-slate-500 mt-1">Konfigurasi operasional LAN GHIFARI CBT dan catatan aktivitas pengguna.</p>
        </div>
        <div className="inline-flex p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 ${
              tab === 'settings' ? 'bg-white text-[#102B50] shadow-sm' : 'text-slate-600'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Pengaturan
          </button>
          <button
            type="button"
            onClick={() => setTab('logs')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md inline-flex items-center gap-1.5 ${
              tab === 'logs' ? 'bg-white text-[#102B50] shadow-sm' : 'text-slate-600'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Audit Log
          </button>
        </div>
      </div>

      {tab === 'settings' ? (
        <div className="grid lg:grid-cols-12 gap-6">
          <form onSubmit={handleSaveSettings} className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-[#102B50] border-b border-slate-100 pb-3">Parameter Operasional</h2>
            <div className="space-y-3">
              {settings.map((item, idx) => (
                <div key={item.key} className="grid sm:grid-cols-12 gap-2 items-center py-2 border-b border-slate-100 last:border-0">
                  <div className="sm:col-span-5">
                    <p className="text-xs font-mono font-semibold text-[#102B50]">{item.key}</p>
                    <p className="text-[11px] text-slate-500">{item.description}</p>
                  </div>
                  <div className="sm:col-span-7">
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => {
                        const next = [...settings];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setSettings(next);
                      }}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </form>

          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 space-y-4 h-fit">
            <div className="flex items-center gap-2 text-[#102B50]">
              <Wifi className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-bold">Alamat Server Jaringan Lokal (LAN)</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bagikan alamat IP berikut ke komputer siswa (30–50 unit client) agar terhubung ke server tanpa internet:
            </p>
            <div className="space-y-2">
              {lanIps.length === 0 ? (
                <p className="text-xs font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200">http://localhost:3000</p>
              ) : (
                lanIps.map((ip) => (
                  <div key={ip} className="px-3 py-2 rounded-lg bg-[#F5F7FB] border border-slate-200 font-mono text-xs font-semibold text-[#102B50]">
                    http://{ip}:3000
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#102B50]">200 Aktivitas Terakhir</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="guru">Guru</option>
              <option value="siswa">Siswa</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Waktu</th>
                  <th className="py-2.5 px-4">Pengguna</th>
                  <th className="py-2.5 px-4">Aksi</th>
                  <th className="py-2.5 px-4">Detail</th>
                  <th className="py-2.5 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">{l.created_at}</td>
                    <td className="py-2.5 px-4 font-medium text-[#102B50] whitespace-nowrap">{l.username} ({l.role})</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#2563EB] whitespace-nowrap">{l.action}</td>
                    <td className="py-2.5 px-4 text-slate-700">{l.details}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">{l.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ======================== BACKUP & RESTORE PAGE ======================== */
export const BackupDatabasePage: React.FC = () => {
  const { showToast } = useToast();
  const [info, setInfo] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadInfo = () => {
    apiFetch('/api/admin/backup/info')
      .then((res) => setInfo(res))
      .catch(() => {});
  };

  useEffect(() => {
    loadInfo();
  }, []);

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      await downloadFile('/api/admin/backup/download', 'ghifari-cbt-backup.db');
      showToast('Cadangan database berhasil dibuat dan diunduh.', 'success');
      loadInfo();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('database', selectedFile);
      const token = getStoredToken();
      const response = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memulihkan database.');
      showToast(data.message, 'success');
      setConfirmOpen(false);
      setSelectedFile(null);
      loadInfo();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-extrabold text-[#102B50]">Backup & Restore Database SQLite</h1>
        <p className="text-xs text-slate-500 mt-1">Amankan seluruh bank soal, data siswa, hasil ujian, dan nilai secara offline.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-[#102B50]/10 text-[#102B50] flex items-center justify-center mb-4">
              <DatabaseBackup className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#102B50]">Unduh Cadangan Database (.db)</h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Membuat salinan konsisten (WAL-safe) database SQLite dan mengunduhnya ke komputer Anda untuk disimpan di drive eksternal.
            </p>
            {info && (
              <div className="mt-4 p-3 rounded-lg bg-[#F5F7FB] border border-slate-200 text-xs space-y-1">
                <p className="text-slate-600">
                  Ukuran DB saat ini: <span className="font-mono font-bold text-[#102B50] tabular-nums">{((info.sizeBytes || 0) / 1024).toFixed(1)} KB</span>
                </p>
                <p className="text-slate-500 font-mono text-[11px] truncate">{info.dbPath}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={downloading}
            className="mt-5 w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Menyiapkan Cadangan...' : 'Buat & Unduh Backup Database'}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#102B50]">Pulihkan Database (Restore)</h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Unggah berkas <span className="font-mono">.db</span> hasil backup GHIFARI CBT. Sistem otomatis mencadangkan database lama sebelum ditimpa.
            </p>
            <div className="mt-4">
              <input
                type="file"
                accept=".db,.sqlite"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-[#102B50] hover:file:bg-slate-200"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!selectedFile}
            onClick={() => setConfirmOpen(true)}
            className="mt-5 w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#102B50] hover:bg-slate-800 rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Upload className="w-4 h-4" />
            Pulihkan dari File Terpilih
          </button>
        </div>
      </div>

      {info?.localBackups?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-xs font-bold text-[#102B50]">Riwayat Cadangan Tersimpan di Server</h3>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {info.localBackups.map((b: any) => (
              <div key={b.name} className="px-5 py-2.5 flex items-center justify-between">
                <span className="font-mono text-slate-700">{b.name}</span>
                <span className="text-slate-500 tabular-nums">{(b.sizeBytes / 1024).toFixed(1)} KB</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRestore}
        loading={restoring}
        title="Konfirmasi Pulihkan Database"
        message={`Database aktif akan digantikan oleh "${selectedFile?.name}". Pastikan tidak ada ujian yang sedang berlangsung saat pemulihan dilakukan.`}
        confirmLabel="Ya, Pulihkan Database"
      />
    </div>
  );
};
