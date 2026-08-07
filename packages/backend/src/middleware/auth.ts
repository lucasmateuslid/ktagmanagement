import type { NextFunction, Request, Response } from 'express';
import { adminAuth, adminDb } from '../services/firebaseAdmin.js';

declare global { namespace Express { interface Request { authUser?: { uid: string; role: string; globalAdmin: boolean } } } }

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Autenticação necessária.' });
  try {
    const token = await adminAuth.verifyIdToken(header.slice(7));
    const tenantId = req.tenantId || '';
    const claimRole = typeof token.tn === 'object' && token.tn ? String((token.tn as Record<string, unknown>)[tenantId] || '') : '';
    let role = claimRole || (token.tenantId === tenantId ? String(token.role || '') : '');
    if (!role && tenantId && tenantId !== 'admin') {
      const member = await adminDb.doc(`tenants/${tenantId}/users/${token.uid}`).get();
      if (member.exists && member.get('status') === 'approved') role = String(member.get('role') || '');
    }
    const globalAdmin = token.superadmin === true || token.platform_admin === true;
    if (!role && !globalAdmin) return res.status(403).json({ ok: false, error: 'Usuário não pertence a esta empresa.' });
    req.authUser = { uid: token.uid, role, globalAdmin };
    next();
  } catch { return res.status(401).json({ ok: false, error: 'Sessão inválida ou expirada.' }); }
}

export function requireGlobalAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.authUser?.globalAdmin) return res.status(403).json({ ok: false, error: 'Acesso exclusivo da administração da plataforma.' });
  next();
}
