import { User, CustomRole } from '../types';
import { storage } from '../services/storage';

const SYSTEM_PERMISSIONS = {
  // Routes
  MONITORAMENTO: ['ROUTE_DASHBOARD', 'ROUTE_MAP'],
  OPERACOES: ['ROUTE_SECURITY', 'ROUTE_VEHICLES', 'ROUTE_SHIPMENTS', 'ROUTE_CLIENTS', 'ROUTE_TAGS'],
  AGENDAMENTOS: ['ROUTE_SCHEDULE_NEW', 'ROUTE_SCHEDULES', 'ROUTE_CALENDAR', 'ROUTE_TECHNICIANS'],
  COMUNIDADE: ['ROUTE_FEEDBACK'],
  GESTAO: ['ROUTE_REPORTS', 'ROUTE_FINANCIAL', 'ROUTE_AUDIT', 'ROUTE_SETTINGS_MODULE_SYSTEM', 'ROUTE_SETTINGS_MODULE_ROLES', 'ROUTE_SETTINGS_MODULE_USERS']
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'admin': [...Object.values(SYSTEM_PERMISSIONS).flat()],
  'admin_tecnico': [...Object.values(SYSTEM_PERMISSIONS).flat()],
  'moderator': ['ROUTE_DASHBOARD', 'ROUTE_MAP', 'ROUTE_SECURITY', 'ROUTE_VEHICLES', 'ROUTE_SHIPMENTS', 'ROUTE_CLIENTS', 'ROUTE_TAGS', 'ROUTE_SCHEDULE_NEW', 'ROUTE_SCHEDULES', 'ROUTE_CALENDAR', 'ROUTE_FEEDBACK', 'ROUTE_REPORTS'],
  'user': ['ROUTE_DASHBOARD', 'ROUTE_MAP', 'ROUTE_SECURITY', 'ROUTE_VEHICLES', 'ROUTE_SHIPMENTS', 'ROUTE_SCHEDULE_NEW', 'ROUTE_SCHEDULES', 'ROUTE_CALENDAR', 'ROUTE_FEEDBACK'],
  'technician': ['ROUTE_DASHBOARD', 'ROUTE_CALENDAR', 'ROUTE_SHIPMENTS', 'ROUTE_SCHEDULES'],
  'client': ['ROUTE_VEHICLES', 'ROUTE_MAP']
};

export const hasPermission = (user: User | null, customRoles: CustomRole[], permission: string): boolean => {
  if (!user) return false;
  
  if (user.customRoleId) {
    const role = customRoles.find(r => r.id === user.customRoleId);
    if (role) {
      return role.permissions.includes(permission);
    }
  }
  
  if (user.role) {
    const role = customRoles.find(r => r.id === user.role);
    if (role) {
      return role.permissions.includes(permission);
    }
  }
  
  // Fallback to base role dictionary
  const role = user.role || 'user';
  return DEFAULT_ROLE_PERMISSIONS[role]?.includes(permission) || false;
};

// Hook-like helper if needed, but the main logic is simple.
