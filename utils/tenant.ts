/**
 * Resolução de tenant a partir do hostname (SPA).
 *
 * Regras:
 *  - Em produção: o subdomínio é o slug do tenant.
 *      empresa1.dominio.com  → tenantId = 'empresa1'
 *      admin.dominio.com     → tenantId = 'admin' (painel super admin — Fase 2)
 *      www.dominio.com       → tenantId = 'default' (landing/redirect — Fase 2)
 *  - Em desenvolvimento (localhost/127.0.0.1):
 *      1. ?tenant=xxx na URL tem prioridade
 *      2. import.meta.env.VITE_DEV_TENANT
 *      3. fallback 'dev-tenant'
 *
 * Slugs reservados não podem ser usados por tenants reais — bloqueiam tentativa
 * de takeover de painel/infra (admin, api, www, etc.).
 */

export const RESERVED_TENANT_SLUGS = [
  'admin',
  'api',
  'www',
  'mail',
  'ftp',
  'static',
  'cdn',
  'auth',
  'app',
  'system',
  'root',
  'localhost',
];

export const DEFAULT_DEV_TENANT = 'dev-tenant';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function isValidTenantSlug(slug: string): boolean {
  if (!slug) return false;
  if (!SLUG_REGEX.test(slug)) return false;
  if (RESERVED_TENANT_SLUGS.includes(slug)) return false;
  return true;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_TENANT_SLUGS.includes(slug);
}

function getDevTenant(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get('tenant');
    if (qp) return qp.toLowerCase();
  }
  // Vite injeta env vars com prefixo VITE_ em import.meta.env
  const envTenant =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env.VITE_DEV_TENANT
      : undefined;
  return (envTenant || DEFAULT_DEV_TENANT).toLowerCase();
}

export function getTenantFromHostname(hostname?: string): string {
  const host =
    hostname ||
    (typeof window !== 'undefined' ? window.location.hostname : '');

  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
    return getDevTenant();
  }

  const parts = host.split('.');
  // ex: 'empresa.dominio.com' → ['empresa', 'dominio', 'com'] → tenant = 'empresa'
  if (parts.length < 3) {
    // domínio apex sem subdomínio (dominio.com) — landing / default
    return 'default';
  }

  return parts[0].toLowerCase();
}

export function isAdminPanelHost(hostname?: string): boolean {
  return getTenantFromHostname(hostname) === 'admin';
}
