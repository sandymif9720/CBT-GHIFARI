import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, User as UserIcon, Server, ShieldCheck, ArrowRight } from 'lucide-react';
import { GhifariLogo } from '../components/GhifariLogo';
import { apiFetch, setStoredToken } from '../utils/api';
import type { AuthUser } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publicInfo, setPublicInfo] = useState<{
    school?: { name?: string; npsn?: string; academic_year?: string; semester?: string };
    lanIps?: string[];
  } | null>(null);

  useEffect(() => {
    apiFetch('/api/auth/public-info')
      .then((data) => setPublicInfo(data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FB]">
      <div className="flex-1 grid lg:grid-cols-12 items-stretch">
        {/* Left Institutional Panel */}
        <div className="lg:col-span-6 bg-[#102B50] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <GhifariLogo size={46} variant="light" subtitle="SMK AL-GHIFARI" />

            <div className="mt-12 max-w-lg">
              <p className="text-xs font-semibold tracking-wider text-blue-300 uppercase">
                Platform Ujian Digital Terintegrasi
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-3 leading-tight [text-wrap:balance]">
                Smarter Examination. Better Education.
              </h1>
              <p className="text-sm sm:text-base text-blue-100/85 mt-4 leading-relaxed">
                Sistem Computer Based Test (CBT) lokal resmi {publicInfo?.school?.name || 'SMK Al-Ghifari'} untuk pengelolaan bank soal, pelaksanaan ujian serentak di jaringan sekolah, pemantauan peserta, serta pelaporan nilai terpadu.
              </p>
            </div>

            <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-lg">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold">
                  <Server className="w-4 h-4" />
                  <span>Operasional Jaringan Lokal</span>
                </div>
                <p className="text-xs text-blue-100/75 mt-1.5 leading-relaxed">
                  Stabil untuk 30–50 komputer client tanpa ketergantungan koneksi internet.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sinkronisasi Waktu Server</span>
                </div>
                <p className="text-xs text-blue-100/75 mt-1.5 leading-relaxed">
                  Auto-save jawaban langsung ke database server dengan pengacakan soal & opsi.
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-10 mt-10 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-200/80">
            <span>
              {publicInfo?.school?.name || 'SMK AL-GHIFARI'} · NPSN {publicInfo?.school?.npsn || '20254108'} · TA {publicInfo?.school?.academic_year || '2026/2027'}
            </span>
            {publicInfo?.lanIps && publicInfo.lanIps.length > 0 && (
              <span className="font-mono text-blue-100">
                LAN: {publicInfo.lanIps[0]}:3000
              </span>
            )}
          </div>
        </div>

        {/* Right Login Form */}
        <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-7 sm:p-9">
            <div className="mb-7">
              <h2 className="text-xl font-extrabold text-[#102B50]">Masuk ke GHIFARI CBT</h2>
              <p className="text-xs text-slate-500 mt-1">
                Gunakan akun Administrator, Guru, atau Peserta Ujian SMK Al-Ghifari.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-[#DC2626]/25 text-xs font-medium text-[#DC2626]"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Username / NIS
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username Anda"
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>{loading ? 'Memeriksa Akun...' : 'Masuk Sekarang'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Demo Account Selector */}
            <div className="mt-7 pt-5 border-t border-slate-200">
              <p className="text-[11px] font-semibold text-slate-500 mb-2.5">
                Akses Cepat Akun Pengujian (Demo):
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo('admin', 'admin123')}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 text-left transition-colors"
                >
                  <span className="block text-xs font-bold text-[#102B50]">Admin</span>
                  <span className="block text-[11px] text-slate-500 font-mono">admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('guru1', 'guru123')}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 text-left transition-colors"
                >
                  <span className="block text-xs font-bold text-[#102B50]">Guru</span>
                  <span className="block text-[11px] text-slate-500 font-mono">guru1</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('siswa1', 'siswa123')}
                  className="px-2.5 py-2 rounded-lg border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 text-left transition-colors"
                >
                  <span className="block text-xs font-bold text-[#102B50]">Siswa</span>
                  <span className="block text-[11px] text-slate-500 font-mono">siswa1</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-white border-t border-slate-200 px-6 py-3.5 text-center text-xs text-slate-500">
        GHIFARI CBT · SMK AL-GHIFARI · <span className="font-semibold text-[#102B50]">Developed by MARGUMI STUDIO</span>
      </footer>
    </div>
  );
};
