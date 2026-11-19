import React, { useEffect, useState } from 'react';
import { ToastProvider, useToast } from './components/ui/Toast';
import { apiFetch, getStoredToken, setStoredToken } from './utils/api';
import type { AuthUser } from './types';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout, type NavKey } from './layouts/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import {
  ClassesPage,
  DepartmentsPage,
  StudentsPage,
  SubjectsPage,
  TeachersPage,
} from './pages/admin/MasterDataPages';
import {
  BackupDatabasePage,
  SchoolIdentityPage,
  SettingsAndLogsPage,
} from './pages/admin/SchoolSettingsPages';
import { QuestionBankPage } from './pages/teacher/QuestionBankPage';
import { ExamManagementPage } from './pages/teacher/ExamManagementPage';
import { MonitoringPage } from './pages/teacher/MonitoringPage';
import { GradingAndReportsPage } from './pages/teacher/GradingAndReportsPage';
import { StudentDashboardPage } from './pages/student/StudentDashboardPage';
import { StudentExamRoom } from './pages/student/StudentExamRoom';

function getActiveExamFromHash(): number | null {
  const match = window.location.hash.match(/^#exam=(\d+)$/);
  return match ? Number(match[1]) : null;
}

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activePage, setActivePage] = useState<NavKey>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [notifications, setNotifications] = useState({ activeExams: 0, pendingEssays: 0 });
  const [focusedExamId, setFocusedExamId] = useState<number | null>(null);
  const [studentExamId, setStudentExamId] = useState<number | null>(getActiveExamFromHash);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setBootstrapping(false);
      return;
    }
    apiFetch<{ user: AuthUser }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setBootstrapping(false));
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setStudentExamId(getActiveExamFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLoginSuccess = (loggedUser: AuthUser) => {
    setUser(loggedUser);
    setActivePage('dashboard');
    setGlobalSearch('');
    showToast(`Selamat datang, ${loggedUser.fullName}.`, 'success');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setStudentExamId(null);
    window.location.hash = '';
    showToast('Anda telah keluar dari GHIFARI CBT.', 'info');
  };

  const handleStartStudentExam = (examId: number) => {
    window.location.hash = `#exam=${examId}`;
    setStudentExamId(examId);
  };

  const handleExitStudentExam = () => {
    window.location.hash = '';
    setStudentExamId(null);
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center">
        <div className="bg-white rounded-xl border border-slate-200 px-8 py-6 text-center">
          <p className="text-sm font-bold text-[#102B50]">GHIFARI CBT</p>
          <p className="text-xs text-slate-500 mt-1">Memeriksa sesi pengguna...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Student Role Flow
  if (user.role === 'siswa') {
    if (studentExamId) {
      return <StudentExamRoom examId={studentExamId} onExitExam={handleExitStudentExam} />;
    }
    return (
      <StudentDashboardPage
        user={user}
        onStartExam={handleStartStudentExam}
        onLogout={handleLogout}
      />
    );
  }

  // Admin & Teacher Role Guarded Navigation
  const isAdmin = user.role === 'admin';
  const adminOnlyPages: NavKey[] = ['school', 'teachers', 'students', 'classes', 'departments', 'subjects', 'settings', 'backup'];
  const safePage: NavKey = !isAdmin && adminOnlyPages.includes(activePage) ? 'dashboard' : activePage;

  const renderPage = () => {
    switch (safePage) {
      case 'dashboard':
        return (
          <DashboardPage
            user={user}
            onNavigate={setActivePage}
            onNotificationsChange={setNotifications}
          />
        );
      case 'school':
        return <SchoolIdentityPage />;
      case 'teachers':
        return <TeachersPage globalSearch={globalSearch} />;
      case 'students':
        return <StudentsPage globalSearch={globalSearch} />;
      case 'classes':
        return <ClassesPage globalSearch={globalSearch} />;
      case 'departments':
        return <DepartmentsPage globalSearch={globalSearch} />;
      case 'subjects':
        return <SubjectsPage globalSearch={globalSearch} />;
      case 'questions':
        return <QuestionBankPage globalSearch={globalSearch} />;
      case 'exams':
        return (
          <ExamManagementPage
            globalSearch={globalSearch}
            onOpenMonitoring={(examId) => {
              setFocusedExamId(examId);
              setActivePage('monitoring');
            }}
            onOpenGrading={(examId) => {
              setFocusedExamId(examId);
              setActivePage('grading');
            }}
          />
        );
      case 'monitoring':
        return <MonitoringPage initialExamId={focusedExamId} />;
      case 'grading':
        return <GradingAndReportsPage mode="grading" initialExamId={focusedExamId} />;
      case 'reports':
        return <GradingAndReportsPage mode="reports" initialExamId={focusedExamId} />;
      case 'settings':
        return <SettingsAndLogsPage />;
      case 'backup':
        return <BackupDatabasePage />;
      default:
        return <DashboardPage user={user} onNavigate={setActivePage} />;
    }
  };

  return (
    <DashboardLayout
      user={user}
      activePage={safePage}
      onNavigate={(page) => {
        setActivePage(page);
        setGlobalSearch('');
      }}
      onLogout={handleLogout}
      globalSearch={globalSearch}
      onGlobalSearchChange={setGlobalSearch}
      notifications={notifications}
    >
      {renderPage()}
    </DashboardLayout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
