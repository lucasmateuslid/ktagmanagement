import * as React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SystemAdminProvider, useSystemAdmin } from '../../contexts/SystemAdminContext';
import { AdminThemeProvider } from '../../hooks/useAdminTheme';
import { AdminLogin } from './AdminLogin';
import { AdminLayout } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { AdminTenants } from './AdminTenants';
import { AdminBilling } from './AdminBilling';
import { AdminInvoices } from './AdminInvoices';
import { AdminUsers } from './AdminUsers';
import { AdminAccess } from './AdminAccess';
import { AdminSystemAdmins } from './AdminSystemAdmins';
import { AdminAudit } from './AdminAudit';
import { AdminAsaasConfig } from './AdminAsaasConfig';
import { AdminPlatformIntegrations } from './AdminPlatformIntegrations';
import { AdminAccount } from './AdminAccount';
import { AdminPlansConfig } from './AdminPlansConfig';
import { AdminFinanceiro } from './AdminFinanceiro';
import { AdminTraccarIntegration } from './AdminTraccarIntegration';

const AdminGate = () => {
  const { admin, loading } = useSystemAdmin();
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return <AdminLogin />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/tenants" element={<AdminTenants />} />
        <Route path="/admin/billing" element={<AdminBilling />} />
        <Route path="/admin/invoices" element={<AdminInvoices />} />
        <Route path="/admin/financeiro" element={<AdminFinanceiro />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/access" element={<AdminAccess />} />
        <Route path="/admin/system-admins" element={<AdminSystemAdmins />} />
        <Route path="/admin/audit" element={<AdminAudit />} />
        <Route path="/admin/asaas-config" element={<AdminAsaasConfig />} />
        <Route path="/admin/platform-integrations" element={<AdminPlatformIntegrations />} />
        <Route path="/admin/integrations" element={<AdminTraccarIntegration />} />
        <Route path="/admin/account" element={<AdminAccount />} />
        <Route path="/admin/plans" element={<AdminPlansConfig />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
};

export const AdminApp = () => (
  <AdminThemeProvider>
    <SystemAdminProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminGate />
      </HashRouter>
    </SystemAdminProvider>
  </AdminThemeProvider>
);
