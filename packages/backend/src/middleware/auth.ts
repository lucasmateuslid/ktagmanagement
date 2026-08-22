import type { NextFunction, Request, Response } from 'express';
import { BUSINESS_MODULE_IDS, type BusinessModuleId } from '@ktag/shared';
import { adminAuth, adminDb } from '../services/firebaseAdmin.js';

export interface AuthUser { uid: string; role: string; globalAdmin: boolean; clientId: string | null; permissions: string[] | null }
declare global { namespace Express { interface Request { authUser?: AuthUser } } }

function firestoreRestFields(document: any): Record<string, any> {
  const fields = document?.fields || {};
  const value = (entry: any): any => {
    if (!entry) return undefined;
    if ('stringValue' in entry) return entry.stringValue;
    if ('booleanValue' in entry) return entry.booleanValue;
    if ('integerValue' in entry) return Number(entry.integerValue);
    if ('arrayValue' in entry) return (entry.arrayValue.values || []).map(value);
    if ('mapValue' in entry) return Object.fromEntries(Object.entries(entry.mapValue.fields || {}).map(([key, item]) => [key, value(item)]));
    return undefined;
  };
  return Object.fromEntries(Object.entries(fields).map(([key, entry]) => [key, value(entry)]));
}

async function readWithUserToken(path: string, authorization: string): Promise<Record<string, any> | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Projeto Firebase local não configurado.');
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`, { headers: { Authorization: authorization } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore recusou leitura de identidade (${response.status}).`);
  return firestoreRestFields(await response.json());
}

const useLocalUserCredential = () => !process.env.K_SERVICE && !process.env.FUNCTION_TARGET && !process.env.GOOGLE_APPLICATION_CREDENTIALS;

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Autenticação necessária.' });
  try {
    const token = await adminAuth.verifyIdToken(header.slice(7));
    const tenantId = req.tenantId || '';
    const claimRole = typeof token.tn === 'object' && token.tn ? String((token.tn as Record<string, unknown>)[tenantId] || '') : '';
    let role = claimRole || (token.tenantId === tenantId ? String(token.role || '') : '');
    let clientId: string | null = null;
    let permissions: string[] | null = null;
    if (tenantId && tenantId !== 'admin') {
      let memberData: Record<string, any> | null;
      try {
        if (useLocalUserCredential()) throw new Error('local-user-credential');
        const member = await adminDb.doc(`tenants/${tenantId}/users/${token.uid}`).get();
        memberData = member.exists ? member.data() || {} : null;
      } catch {
        memberData = await readWithUserToken(`tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(token.uid)}`, header);
      }
      if (!memberData || memberData.status !== 'approved') role = '';
      else {
        role = String(memberData.role || role || '');
        clientId = memberData.clientId ? String(memberData.clientId) : null;
        const customRoleId = memberData.customRoleId ? String(memberData.customRoleId) : '';
        if (customRoleId) {
          try {
            if (useLocalUserCredential()) throw new Error('local-user-credential');
            const customRole = await adminDb.doc(`tenants/${tenantId}/custom_roles/${customRoleId}`).get();
            permissions = customRole.exists && Array.isArray(customRole.get('permissions')) ? customRole.get('permissions') : [];
          } catch {
            const customRole = await readWithUserToken(`tenants/${encodeURIComponent(tenantId)}/custom_roles/${encodeURIComponent(customRoleId)}`, header);
            permissions = Array.isArray(customRole?.permissions) ? customRole!.permissions.map(String) : [];
          }
        }
      }
    }
    let globalAdmin = token.superadmin === true || token.platform_admin === true;
    // No painel local a claim pode estar desatualizada, embora o documento
    // system_admins já exista. Confirma o próprio registro via REST usando o
    // mesmo token do usuário (as Firestore Rules permitem somente essa leitura).
    if (!globalAdmin && tenantId === 'admin') {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
      if (projectId) {
        const adminCheck = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/system_admins/${encodeURIComponent(token.uid)}`, {
          headers: { Authorization: header },
        });
        globalAdmin = adminCheck.ok;
      }
    }
    if (!role && !globalAdmin) return res.status(403).json({ ok: false, error: 'Usuário não pertence a esta empresa.' });
    if (role === 'client' && !clientId) return res.status(403).json({ ok: false, error: 'Conta de cliente sem vínculo válido.' });
    req.authUser = { uid: token.uid, role, globalAdmin, clientId, permissions };
    next();
  } catch (error: any) {
    const code = String(error?.code || '');
    const credentialFailure = code.includes('app/invalid-credential')
      || code.includes('app/invalid-app-options')
      || String(error?.message || '').includes('default credentials');
    console.error('firebase token verification failed', { code: code || 'unknown', message: error?.message || String(error) });
    if (credentialFailure) {
      return res.status(503).json({ ok: false, error: 'Backend local sem credencial do Firebase Admin.' });
    }
    return res.status(401).json({ ok: false, error: 'Sessão inválida ou expirada.' });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) return res.status(403).json({ ok: false, error: 'Permissão insuficiente.' });
    next();
  };
}

export const requireInternalUser = requireRoles('admin', 'admin_tecnico', 'moderator', 'user', 'technician');
export const requireTrackingManager = requireRoles('admin', 'moderator');

export function requirePermission(permission: string, fallbackRoles: string[] = ['admin']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.authUser;
    if (!user) return res.status(401).json({ ok: false, error: 'Autenticação necessária.' });
    const allowed = user.globalAdmin || (user.permissions ? user.permissions.includes(permission) : fallbackRoles.includes(user.role));
    if (!allowed) return res.status(403).json({ ok: false, error: 'Módulo não liberado para este cargo.' });
    next();
  };
}

export { BUSINESS_MODULE_IDS };

/** Licença do tenant. Esta checagem vem antes das permissões do cargo. */
export async function getEnabledTenantModules(tenantId: string, authorization?: string): Promise<string[]> {
  let data: Record<string, any> | null;
  try {
    if (authorization && useLocalUserCredential()) throw new Error('local-user-credential');
    const tenant = await adminDb.doc(`tenants/${tenantId}`).get();
    data = tenant.exists ? tenant.data() || {} : null;
  } catch (error) {
    if (!authorization) throw error;
    data = await readWithUserToken(`tenants/${encodeURIComponent(tenantId)}`, authorization);
  }
  if (!data || data.active === false) return [];
  const override = data.settings?.features;
  if (Array.isArray(override)) return override.map(String);
  // Ausência de autorização explícita é negação. O plano pode sugerir
  // módulos no painel comercial, mas não concede acesso operacional sozinho.
  return [];
}

export function requireTenantModule(moduleId: BusinessModuleId) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId || '';
      if (req.authUser?.globalAdmin) return next();
      const enabled = await getEnabledTenantModules(tenantId, req.headers.authorization || '');
      if (!enabled.includes(moduleId)) return res.status(403).json({ ok: false, error: 'Módulo não contratado/liberado para esta empresa.' });
      next();
    } catch {
      return res.status(503).json({ ok: false, error: 'Não foi possível validar a licença do módulo.' });
    }
  };
}

export function requireGlobalAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser?.globalAdmin) return res.status(403).json({ ok: false, error: 'Acesso exclusivo da administração da plataforma.' });
  next();
}
