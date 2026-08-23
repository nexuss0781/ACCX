import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import CategoriesPage from './pages/CategoriesPage';
import FoldersPage from './pages/FoldersPage';
import NotesPage from './pages/NotesPage';
import { accxApi } from './lib/accxApi';

function Guard({ children, publicOnly = false }: { children: React.ReactNode; publicOnly?: boolean }) {
  const { user, setUser } = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => { void accxApi.session().then(({ user: cloudUser }) => setUser(cloudUser)).catch(() => setUser(null)).finally(() => setReady(true)); }, [setUser]);
  if (!ready) return <div className="min-h-screen bg-bg-base" />;
  if (publicOnly) return user ? <Navigate to="/" replace /> : <>{children}</>;
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Guard publicOnly><LoginPage /></Guard>} />
        <Route path="/register" element={<Guard publicOnly><RegisterPage /></Guard>} />
        <Route path="/" element={<Guard><DashboardPage /></Guard>} />
        <Route path="/accounts" element={<Guard><AccountsPage /></Guard>} />
        <Route path="/categories" element={<Guard><CategoriesPage /></Guard>} />
        <Route path="/folders" element={<Guard><FoldersPage /></Guard>} />
        <Route path="/notes" element={<Guard><NotesPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
