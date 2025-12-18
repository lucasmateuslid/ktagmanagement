
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

  // O AuthContext já lida com a tela de loading global. 
  // Se chegamos aqui e loading é falso mas não estamos autenticados, redirecionamos.
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return null; // O AuthProvider já mostra o loader principal
  if (!isAuthenticated) return null;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const RoleProtectedRoute = ({ roles, children }: { roles: string[], children?: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  
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

                    <Route path="/tags" element={<RoleProtectedRoute roles={['admin', 'moderator']}><Tags /></RoleProtectedRoute>} />
                    <Route path="/reports" element={<RoleProtectedRoute roles={['admin', 'moderator']}><Reports /></RoleProtectedRoute>} />
                    <Route path="/audit" element={<RoleProtectedRoute roles={['admin', 'moderator']}><AuditLogs /></RoleProtectedRoute>} />

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
