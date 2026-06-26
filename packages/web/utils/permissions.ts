import { User, CustomRole } from '../types';

// =============================================================================
// Catálogo central de permissões — usado por sidebar, RoleProtectedRoute e
// PermissionsModule. Cada constante é o ID gravado em CustomRole.permissions.
// =============================================================================
export const PERMISSIONS = {
  DASHBOARD: 'ROUTE_DASHBOARD',
  MAP: 'ROUTE_MAP',
  SECURITY: 'ROUTE_SECURITY',
  VEHICLES: 'ROUTE_VEHICLES',
  SHIPMENTS: 'ROUTE_SHIPMENTS',
  CLIENTS: 'ROUTE_CLIENTS',
  TAGS: 'ROUTE_TAGS',
  SCHEDULE_NEW: 'ROUTE_SCHEDULE_NEW',
  SCHEDULES: 'ROUTE_SCHEDULES',
  CALENDAR: 'ROUTE_CALENDAR',
  TECHNICIANS: 'ROUTE_TECHNICIANS',
  FEEDBACK: 'ROUTE_FEEDBACK',
  REPORTS: 'ROUTE_REPORTS',
  FINANCIAL: 'ROUTE_FINANCIAL',
  BILLING: 'ROUTE_BILLING',
  AUDIT: 'ROUTE_AUDIT',
  SETTINGS_MODULE_SYSTEM: 'ROUTE_SETTINGS_MODULE_SYSTEM',
  SETTINGS_MODULE_ROLES: 'ROUTE_SETTINGS_MODULE_ROLES',
  SETTINGS_MODULE_USERS: 'ROUTE_SETTINGS_MODULE_USERS',
  SETTINGS_MODULE_ANNOUNCEMENT: 'ROUTE_SETTINGS_MODULE_ANNOUNCEMENT',
} as const;

export type PermissionId = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// IDs em ordem canônica — fonte para o PermissionsModule listar checkboxes.
export const ALL_PERMISSION_IDS: PermissionId[] = Object.values(PERMISSIONS);

// Defaults por role base do sistema. Quando o usuário tem um cargo do sistema
// (sem customRoleId), ou quando o cargo customizado não foi encontrado, caímos
// aqui. Manter sincronizado com o seed em PermissionsModule.tsx.
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionId[]> = {
  sysadmin: [...ALL_PERMISSION_IDS],
  admin: ALL_PERMISSION_IDS.filter(id => id !== PERMISSIONS.SETTINGS_MODULE_ROLES === false ? true : true),
  admin_tecnico: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.SCHEDULES,
    PERMISSIONS.CALENDAR,
    PERMISSIONS.TECHNICIANS,
    PERMISSIONS.FINANCIAL,
    PERMISSIONS.SHIPMENTS,
  ],
  moderator: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.MAP,
    PERMISSIONS.SECURITY,
    PERMISSIONS.VEHICLES,
    PERMISSIONS.SHIPMENTS,
    PERMISSIONS.CLIENTS,
    PERMISSIONS.TAGS,
    PERMISSIONS.SCHEDULE_NEW,
    PERMISSIONS.SCHEDULES,
    PERMISSIONS.CALENDAR,
    PERMISSIONS.TECHNICIANS,
    PERMISSIONS.FEEDBACK,
    PERMISSIONS.REPORTS,
  ],
  user: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.MAP,
    PERMISSIONS.VEHICLES,
    PERMISSIONS.SHIPMENTS,
    PERMISSIONS.SCHEDULE_NEW,
    PERMISSIONS.SCHEDULES,
    PERMISSIONS.CALENDAR,
    PERMISSIONS.FEEDBACK,
  ],
  technician: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.SCHEDULES,
    PERMISSIONS.CALENDAR,
    PERMISSIONS.FINANCIAL,
    PERMISSIONS.SHIPMENTS,
  ],
  client: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.MAP,
    PERMISSIONS.VEHICLES,
    PERMISSIONS.SCHEDULE_NEW,
  ],
};

// Admin recebe tudo *exceto* gerenciar cargos? Não — admin gerencia cargos.
// O Super Admin é o único com privilégio absoluto e imutável.
DEFAULT_ROLE_PERMISSIONS.admin = [...ALL_PERMISSION_IDS];

/**
 * Verifica se um usuário tem determinada permissão.
 *
 * Ordem de prioridade:
 *   1. Se o user tem customRoleId, usa o cargo customizado (fonte autoritativa).
 *   2. Senão, se o user.role bate com um cargo do sistema cadastrado, usa ele.
 *   3. Por fim, cai para DEFAULT_ROLE_PERMISSIONS (defesa em profundidade pra
 *      o caso do cargo do sistema não ter sido seedado ainda).
 *
 * Importante: sysadmin sempre passa, mesmo sem cargo cadastrado — evita lock-out
 * em situações de seed quebrado.
 */
export const hasPermission = (
  user: User | null,
  customRoles: CustomRole[],
  permission: string
): boolean => {
  if (!user) return false;

  // Super admin curto-circuita — não confiamos em cargo cadastrado pra esse.
  if (user.role === 'sysadmin' || user.role === 'superadmin') return true;

  if (user.customRoleId) {
    const role = customRoles.find(r => r.id === user.customRoleId);
    if (role) return role.permissions.includes(permission);
    // customRoleId aponta pra cargo que não existe mais — cai pra default.
  }

  if (user.role) {
    const role = customRoles.find(r => r.id === user.role);
    if (role) return role.permissions.includes(permission);
  }

  const fallback = DEFAULT_ROLE_PERMISSIONS[user.role || 'user'] || [];
  return fallback.includes(permission as PermissionId);
};
