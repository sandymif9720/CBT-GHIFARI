import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  UserCheck,
  Users,
  School as SchoolIcon,
  Layers,
  BookOpen,
  FileSpreadsheet,
  ClipboardCheck,
  Activity,
  Award,
  BarChart3,
  Settings,
  DatabaseBackup,
  Search,
  Bell,
  ChevronRight,
  LogOut,
  KeyRound,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';
import type { AuthUser } from '../types';
import { GhifariLogo } from '../components/GhifariLogo';
import { Modal } from '../components/ui/Modal';
import { apiFetch } from '../utils/api';
import { useToast } from '../components/ui/Toast';

export type NavKey =
  | 'dashboard'
  | 'school'
  | 'teachers'
  | 'students'
  | 'classes'
  | 'departments'
  | 'subjects'
  | 'questions'
  | 'exams'
  | 'monitoring'
  | 'grading'
  | 'reports'
  | 'settings'
  | 'backup';

interface NavItem {
  key: NavKey;
  label: string;
  icon: React.ReactNode;
  roles: Array<'admin' | 'guru'>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['admin', 'guru'] },
  { key: 'school', label: 'Data Sekolah', icon: <Building2 className="w-4 h-4" />, roles: ['admin'] },
  { key: 'teachers', label: 'Guru', icon: <UserCheck className="w-4 h-4" />, roles: ['admin'] },
  { key: 'students', label: 'Siswa', icon: <Users className="w-4 h-4" />, roles: ['admin'] },
  { key: 'classes', label: 'Kelas', icon: <SchoolIcon className="w-4 h-4" />, roles: ['admin'] },
  { key: 'departments', label: 'Jurusan', icon: <Layers className="w-4 h-4" />, roles: ['admin'] },
  { key: 'subjects', label: 'Mata Pelajaran', icon: <BookOpen className="w-4 h-4" />, roles: ['admin'] },
  { key: 'questions', label: 'Bank Soal', icon: <FileSpreadsheet className="w-4 h-4" />, roles: ['admin', 'guru'] },
  { key: 'exams', label: 'Ujian', icon: <ClipboardCheck className="w-4 h-4" />, roles: ['admin', 'guru'] },
  { key: 'monitoring', label: 'Monitoring', icon: <Activity className="w-4 h-4" />, roles: ['admin', 'guru'] },
  { key: 'grading', label: 'Hasil Ujian', icon: <Award className="w-4 h-4" />, roles: ['admin', 'guru'] },
  { key: 'reports', label: 'Laporan', icon: <BarChart3 className="w-4 h-4" />, roles: ['admin', 'guru'] },
  { key: 'settings', label: 'Pengaturan', icon: <Settings className="w-4 h-4" />, roles: ['admin'] },
  { key: 'backup', label: 'Backup Database', icon: <DatabaseBackup className="w-4 h-4" />, roles: ['admin'] },
];

interface DashboardLayoutProps {
  user: AuthUser;
  activePage: NavKey;
  onNavigate: (page: NavKey) => void;
  onLogout: () => void;
  globalSearch: string;
  onGlobalSearchChange: (val: string) => void;
  notifications?: { activeExams: number; pendingEssays: number };
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  activePage,
  onNavigate,
  onLogout,
  globalSearch,
  onGlobalSearchChange,
  notifications = { activeExams: 0, pendingEssays: 0 },
  children,
}) => {
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(user.role as 'admin' | 'guru')),
    [user.role]
  );

  const currentNavLabel = visibleNav.find((n) => n.key === activePage)?.label || 'Dashboard';
  const totalNotifCount = (notifications.activeExams > 0 ? 1 : 0) + (notifications.pendingEssays > 0 ? 1 : 0);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPwd(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast(res.message, 'success');
      setPwdModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengganti kata sandi.', 'error');
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F7FB] text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#102B50] text-white flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-2">
          <GhifariLogo size={36} variant="light" subtitle={user.school?.name || 'SMK AL-GHIFARI'} />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const active = activePage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onNavigate(item.key);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-blue-200/75 leading-relaxed">
          <p className="font-semibold text-white/90">SMK AL-GHIFARI</p>
          <p>Developed by MARGUMI STUDIO</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-slate-400 font-medium whitespace-nowrap hidden sm:inline">GHIFARI CBT</span>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 hidden sm:inline" />
              <span className="font-bold text-[#102B50] truncate">{currentNavLabel}</span>
            </nav>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative hidden md:block w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                placeholder="Cari di halaman ini..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-[#F5F7FB] border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
              />
            </div>

            {/* Notification Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setProfileOpen(false);
                }}
                aria-label="Notifikasi"
                className="relative p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {totalNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {totalNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-lg p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-[#102B50]">Pusat Informasi</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('monitoring');
                        setNotifOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100"
                    >
                      <p className="text-xs font-semibold text-[#102B50]">Ujian Berlangsung</p>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {notifications.activeExams} ujian sedang aktif saat ini.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('grading');
                        setNotifOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100"
                    >
                      <p className="text-xs font-semibold text-[#102B50]">Penilaian Esai</p>
                      <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        {notifications.pendingEssays} jawaban esai menunggu dinilai guru.
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-[#102B50] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-tight text-left">
                  <span className="text-xs font-bold text-[#102B50] max-w-[130px] truncate">{user.fullName}</span>
                  <span className="text-[11px] text-slate-500 capitalize">
                    {user.role === 'admin' ? 'Admin Sekolah' : 'Guru Pengampu'}
                  </span>
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-[#102B50] truncate">{user.fullName}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <UserIcon className="w-3 h-3" /> @{user.username}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setPwdModalOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    Ubah Kata Sandi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-[#DC2626] hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar Sistem
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        {/* Institutional Footer */}
        <footer className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            GHIFARI CBT · {user.school?.name || 'SMK AL-GHIFARI'} · Tahun Ajaran {user.school?.academic_year || '2026/2027'}
          </span>
          <span className="font-medium text-slate-600">Developed by MARGUMI STUDIO</span>
        </footer>
      </div>

      {/* Change Password Modal */}
      <Modal
        open={pwdModalOpen}
        onClose={() => setPwdModalOpen(false)}
        title="Ubah Kata Sandi Akun"
        subtitle="Pastikan kata sandi baru minimal 6 karakter."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Sandi Saat Ini</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Kata Sandi Baru</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPwdModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingPwd}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {savingPwd ? 'Menyimpan...' : 'Simpan Kata Sandi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
