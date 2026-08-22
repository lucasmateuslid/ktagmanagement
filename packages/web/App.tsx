
import React, { useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider, useTenant } from './contexts/TenantContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Layout } from './components/Layout';
import { useScheduleNotifications } from './hooks/useScheduleNotifications';
import { AdminApp } from './pages/admin/AdminApp';

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
const Billing = lazy(() => import('./pages/Billing').then(m => ({ default: m.Billing })));
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

// Traccar GPS
const TrackersPage = lazy(() => import('./pages/trackers/TrackersPage').then(m => ({ default: m.TrackersPage })));
const AssetManagement = lazy(() => import('./pages/AssetManagement').then(m => ({ default: m.AssetManagement })));

import { hasPermission } from './utils/permissions';

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

const RoleProtectedRoute = ({ 
  roles, 
  permission, 
  module,
  children 
}: { 
  roles?: string[], 
  permission?: string, 
  module?: string,
  children?: React.ReactNode 
}) => {
  const { user, customRoles, isAuthenticated, loading } = useAuth();
  const { enabledModules, modulesLoading } = useTenant();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (module && (modulesLoading || !enabledModules.includes(module))) {
    return modulesLoading ? null : <Navigate to="/" replace />;
  }
  
  if (permission && !hasPermission(user, customRoles, permission)) {
     return <Navigate to="/" replace />;
  }

  if (roles && !roles.includes(user?.role || 'user')) {
    // Permitir se tiver permissões customizadas de super admin?
    // Vamos deixar a checagem básica apenas se não usar a checagem de permission
    if (!permission) {
        return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

import { WhitelabelStyles } from './components/WhitelabelStyles';

const TenantRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/track/:token" element={<PublicTracking />} />
    <Route path="/technician-registration" element={
      <RoleProtectedRoute roles={['technician']}>
        <TechnicianRegistration />
      </RoleProtectedRoute>
    } />
    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<RoleProtectedRoute permission="ROUTE_DASHBOARD"><Dashboard /></RoleProtectedRoute>} />
      <Route path="/map" element={<RoleProtectedRoute permission="ROUTE_MAP"><LiveMap /></RoleProtectedRoute>} />
      <Route path="/vehicles" element={<RoleProtectedRoute permission="ROUTE_VEHICLES"><Vehicles /></RoleProtectedRoute>} />
      <Route path="/security" element={<RoleProtectedRoute permission="ROUTE_SECURITY"><Security /></RoleProtectedRoute>} />
      {/* /settings é acessível por qualquer usuário autenticado — a tela
          interna gateia cards por hasPermission(). */}
      <Route path="/settings" element={<Settings />} />

      {/* Agendamentos */}
      <Route path="/schedule/new" element={<RoleProtectedRoute module="scheduling" permission="ROUTE_SCHEDULE_NEW"><ScheduleRequest /></RoleProtectedRoute>} />
      <Route path="/schedules" element={<RoleProtectedRoute module="scheduling" permission="ROUTE_SCHEDULES"><Schedules /></RoleProtectedRoute>} />
      <Route path="/calendar" element={<RoleProtectedRoute module="scheduling" permission="ROUTE_CALENDAR"><Calendar /></RoleProtectedRoute>} />
      <Route path="/technicians" element={<RoleProtectedRoute module="scheduling" permission="ROUTE_TECHNICIANS"><Technicians /></RoleProtectedRoute>} />
      <Route path="/technicians/financials" element={<RoleProtectedRoute module="scheduling" permission="ROUTE_FINANCIAL"><TechnicianFinancials /></RoleProtectedRoute>} />

      {/* Envios */}
      <Route path="/envios" element={<RoleProtectedRoute module="shipments" permission="ROUTE_SHIPMENTS"><ShipmentsList /></RoleProtectedRoute>} />
      <Route path="/envios/:id/editar" element={<RoleProtectedRoute module="shipments" permission="ROUTE_SHIPMENTS"><ShipmentForm /></RoleProtectedRoute>} />
      <Route path="/envios/nova" element={<RoleProtectedRoute module="shipments" permission="ROUTE_SHIPMENTS"><ShipmentForm /></RoleProtectedRoute>} />
      <Route path="/envios/:id" element={<RoleProtectedRoute module="shipments" permission="ROUTE_SHIPMENTS"><ShipmentDetails /></RoleProtectedRoute>} />
      <Route path="/envios/:id/imprimir" element={<RoleProtectedRoute module="shipments" permission="ROUTE_SHIPMENTS"><ShipmentPrint /></RoleProtectedRoute>} />

      {/* Feedback */}
      <Route path="/feedback" element={<RoleProtectedRoute permission="ROUTE_FEEDBACK"><FeedbackPage /></RoleProtectedRoute>} />

      <Route path="/clients" element={<RoleProtectedRoute permission="ROUTE_CLIENTS"><Clients /></RoleProtectedRoute>} />
      <Route path="/tags" element={<RoleProtectedRoute permission="ROUTE_TAGS"><Tags /></RoleProtectedRoute>} />
      <Route path="/reports" element={<RoleProtectedRoute permission="ROUTE_REPORTS"><Reports /></RoleProtectedRoute>} />
      <Route path="/audit" element={<RoleProtectedRoute permission="ROUTE_AUDIT"><AuditLogs /></RoleProtectedRoute>} />
      <Route path="/billing" element={<RoleProtectedRoute permission="ROUTE_BILLING"><Billing /></RoleProtectedRoute>} />
      <Route path="/trackers" element={<RoleProtectedRoute module="trackers" permission="ROUTE_ASSETS"><TrackersPage /></RoleProtectedRoute>} />
      <Route path="/assets" element={<RoleProtectedRoute module="trackers" permission="ROUTE_ASSETS"><AssetManagement /></RoleProtectedRoute>} />
    </Route>
  </Routes>
);

const TenantApp = () => (
  <AuthProvider>
    <ThemeProvider>
      <WhitelabelStyles />
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<div className="h-screen w-screen bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>}>
          <TenantRoutes />
        </Suspense>
      </HashRouter>
    </ThemeProvider>
  </AuthProvider>
);

// Quando o tenant resolvido é "admin", monta o sub-app de super admin
// (com seu próprio Auth flow). Caso contrário, monta a app de tenant normal.
const AppRouter = () => {
  const { isAdminPanel } = useTenant();
  return isAdminPanel ? <AdminApp /> : <TenantApp />;
};

function App() {
  return (
    // reducedMotion="user" faz TODO o framer-motion respeitar prefers-reduced-motion (UI-001).
    <MotionConfig reducedMotion="user">
      <NotificationProvider>
        <ConnectionProvider>
          <LanguageProvider>
            <TenantProvider>
              <AppRouter />
            </TenantProvider>
          </LanguageProvider>
        </ConnectionProvider>
      </NotificationProvider>
    </MotionConfig>
  );
}

export default App;
