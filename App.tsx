
import React, { useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Tags } from './pages/Tags';
import { Vehicles } from './pages/Vehicles';
import { LiveMap } from './pages/LiveMap';
import { Settings } from './pages/Settings';
import { Security } from './pages/Security';
import { Users } from './pages/Users';
import { Reports } from './pages/Reports';
import { AuditLogs } from './pages/AuditLogs';

const { HashRouter, Routes, Route, useNavigate, Outlet, Navigate } = ReactRouterDOM as any;

const ProtectedLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-primary-500">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="font-display font-bold tracking-widest text-sm uppercase">K-TAG Loading</span>
      </div>
    </div>
  );
  
  if (!isAuthenticated) return null;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

// Componente para rotas de Admin e Moderador
const RoleProtectedRoute = ({ roles, children }: { roles: string[], children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!roles.includes(user?.role || 'user')) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <NotificationProvider>
      <ConnectionProvider>
        <LanguageProvider>
          <AuthProvider>
            <ThemeProvider>
              <HashRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  
                  <Route element={<ProtectedLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/map" element={<LiveMap />} />
                    <Route path="/vehicles" element={<Vehicles />} />
                    <Route path="/security" element={<Security />} />
                    <Route path="/settings" element={<Settings />} />

                    {/* Rotas restritas a Moderadores e Admins */}
                    <Route path="/tags" element={<RoleProtectedRoute roles={['admin', 'moderator']}><Tags /></RoleProtectedRoute>} />
                    <Route path="/reports" element={<RoleProtectedRoute roles={['admin', 'moderator']}><Reports /></RoleProtectedRoute>} />
                    <Route path="/audit" element={<RoleProtectedRoute roles={['admin', 'moderator']}><AuditLogs /></RoleProtectedRoute>} />

                    {/* Rotas restritas apenas a Admins */}
                    <Route path="/users" element={<RoleProtectedRoute roles={['admin']}><Users /></RoleProtectedRoute>} />
                  </Route>
                </Routes>
              </HashRouter>
            </ThemeProvider>
          </AuthProvider>
        </LanguageProvider>
      </ConnectionProvider>
    </NotificationProvider>
  );
}

export default App;
