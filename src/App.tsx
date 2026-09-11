import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import ProjectsPage from './pages/ProjectsPage';
import EnvironmentPage from './pages/EnvironmentPage';
import ApiKeysPage from './pages/ApiKeysPage';
import CategoriesPage from './pages/CategoriesPage';
import FoldersPage from './pages/FoldersPage';
import NotesPage from './pages/NotesPage';
import { accxApi } from './lib/accxApi';

function Guard({ children, publicOnly = false }: { children: React.ReactNode; publicOnly?: boolean }) {
  const user = useStore(s => s.user);
  const setUser = useStore(s => s.setUser);
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const validated = useRef(false);

  useEffect(() => {
    if (validated.current) return;
    validated.current = true;
    let cancelled = false;
    void accxApi.session()
      .then(({ user: cloudUser }) => { if (!cancelled) setUser(cloudUser ?? null); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [setUser]);

  if (!ready && !user) return <div className="min-h-screen bg-bg-base" />;
  if (publicOnly) return user ? <Navigate to="/" replace /> : <>{children}</>;
  const from = location.pathname + location.search;
  return user ? <Layout>{children}</Layout> : <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Guard publicOnly><LoginPage /></Guard>} />
        <Route path="/register" element={<Guard publicOnly><RegisterPage /></Guard>} />
        <Route path="/" element={<Guard><DashboardPage /></Guard>} />
        <Route path="/accounts" element={<Guard><AccountsPage /></Guard>} />
        <Route path="/projects" element={<Guard><ProjectsPage /></Guard>} />
        <Route path="/environment" element={<Guard><EnvironmentPage /></Guard>} />
        <Route path="/api-keys" element={<Guard><ApiKeysPage /></Guard>} />
        <Route path="/categories" element={<Guard><CategoriesPage /></Guard>} />
        <Route path="/folders" element={<Guard><FoldersPage /></Guard>} />
        <Route path="/notes" element={<Guard><NotesPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}