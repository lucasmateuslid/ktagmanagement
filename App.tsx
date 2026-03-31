
import React, { useEffect, Suspense, lazy } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Layout } from './components/Layout';
import { useScheduleNotifications } from './hooks/useScheduleNotifications'; // New hook import

// Carregamento Preguiçoso (Lazy Loading) - Otimiza o bundle inicial
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Tags = lazy(() => import('./pages/Tags').then(m => ({ default: m.Tags })));
const Vehicles = lazy(() => import('./pages/Vehicles').then(m => ({ default: m.Vehicles })));
const Clients = lazy(() => import('./pages/Clients').then(m => ({ default: m.Clients })));
const LiveMap = lazy(() => import('./pages/LiveMap').then(m => ({ default: m.LiveMap })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Security = lazy(() => import('./pages/Security').then(m => ({ default: m.Security })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const AuditLogs = lazy(() => import('./pages/AuditLogs').then(m => ({ default: m.AuditLogs })));
const FeedbackPage = lazy(() => import('./pages/Feedback').then(m => ({ default: m.FeedbackPage }))); // New
const PublicTracking = lazy(() => import('./pages/PublicTracking').then(m => ({ default: m.PublicTracking })));

// New Pages
const ScheduleRequest = lazy(() => import('./pages/ScheduleRequest').then(m => ({ default: m.ScheduleRequest })));
const Schedules = lazy(() => import('./pages/Schedules').then(m => ({ default: m.Schedules })));
const Calendar = lazy(() => import('./pages/Calendar').then(m => ({ default: m.Calendar })));
const Technicians = lazy(() => import('./pages/Technicians').then(m => ({ default: m.Technicians })));
const TechnicianRegistration = lazy(() => import('./pages/TechnicianRegistration').then(m => ({ default: m.TechnicianRegistration })));
const TechnicianFinancials = lazy(() => import('./pages/TechnicianFinancials').then(m => ({ default: m.TechnicianFinancials })));

// Shipments
const ShipmentsList = lazy(() => import('./pages/Shipments/ShipmentsList').then(m => ({ default: m.ShipmentsList })));
const ShipmentForm = lazy(() => import('./pages/Shipments/ShipmentForm').then(m => ({ default: m.ShipmentForm })));
const ShipmentDetails = lazy(() => import('./pages/Shipments/ShipmentDetails').then(m => ({ default: m.ShipmentDetails })));
const ShipmentPrint = lazy(() => import('./pages/Shipments/ShipmentPrint').then(m => ({ default: m.ShipmentPrint })));

const { HashRouter, Routes, Route, useNavigate, Outlet, Navigate } = ReactRouterDOM as any;

const LoadingFallback = () => (
  <div className="h-full w-full flex items-center justify-center p-20">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Carregando Módulo...</span>
    </div>
  </div>
);

const ProtectedLayout = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  
  // Ativa notificações globais
  useScheduleNotifications();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { replace: true });
    } else if (!loading && isAuthenticated && user?.role === 'technician' && (!user.cpf || !user.pixKey)) {
      navigate('/technician-registration', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, user]);

  if (loading || !isAuthenticated) return null;

  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
};

const RoleProtectedRoute = ({ roles, children }: { roles: string[], children?: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!roles.includes(user?.role || 'user')) return <Navigate to="/" replace />;
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
                <Suspense fallback={<div className="h-screen w-screen bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/track/:token" element={<PublicTracking />} />
                    <Route path="/technician-registration" element={
                      <RoleProtectedRoute roles={['technician']}>
                        <TechnicianRegistration />
                      </RoleProtectedRoute>
                    } />
                    <Route element={<ProtectedLayout />}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/map" element={<LiveMap />} />
                      <Route path="/vehicles" element={<Vehicles />} />
                      <Route path="/security" element={<Security />} />
                      <Route path="/settings" element={<Settings />} />
                      
                      {/* Agendamentos - Permite User, Admin e Moderator */}
                      <Route path="/schedule/new" element={<RoleProtectedRoute roles={['user', 'admin', 'moderator', 'admin_tecnico']}><ScheduleRequest /></RoleProtectedRoute>} />
                      <Route path="/schedules" element={<Schedules />} /> {/* Acesso condicional gerido dentro da página */}
                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/technicians" element={<RoleProtectedRoute roles={['admin', 'admin_tecnico']}><Technicians /></RoleProtectedRoute>} />
                      <Route path="/technicians/financials" element={<RoleProtectedRoute roles={['admin', 'admin_tecnico']}><TechnicianFinancials /></RoleProtectedRoute>} />

                      {/* Envios */}
                      <Route path="/envios" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><ShipmentsList /></RoleProtectedRoute>} />
                      <Route path="/envios/:id/editar" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><ShipmentForm /></RoleProtectedRoute>} />
                      <Route path="/envios/nova" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><ShipmentForm /></RoleProtectedRoute>} />
                      <Route path="/envios/:id" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><ShipmentDetails /></RoleProtectedRoute>} />
                      <Route path="/envios/:id/imprimir" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><ShipmentPrint /></RoleProtectedRoute>} />

                      {/* Feedback - Available to all non-clients */}
                      <Route path="/feedback" element={<RoleProtectedRoute roles={['user', 'admin', 'moderator', 'admin_tecnico']}><FeedbackPage /></RoleProtectedRoute>} />

                      <Route path="/clients" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><Clients /></RoleProtectedRoute>} />
                      <Route path="/tags" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><Tags /></RoleProtectedRoute>} />
                      <Route path="/reports" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><Reports /></RoleProtectedRoute>} />
                      <Route path="/audit" element={<RoleProtectedRoute roles={['admin', 'moderator', 'admin_tecnico']}><AuditLogs /></RoleProtectedRoute>} />
                      <Route path="/users" element={<RoleProtectedRoute roles={['admin', 'admin_tecnico']}><Users /></RoleProtectedRoute>} />
                    </Route>
                  </Routes>
                </Suspense>
              </HashRouter>
            </ThemeProvider>
          </AuthProvider>
        </LanguageProvider>
      </ConnectionProvider>
    </NotificationProvider>
  );
}

export default App;
