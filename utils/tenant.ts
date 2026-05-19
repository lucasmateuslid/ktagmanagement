/**
 * Resolução de tenant a partir do hostname (SPA).
 *
 * Regras:
 *  - Em produção: o subdomínio é o slug do tenant.
 *      empresa1.ktagfinder.app  → tenantId = 'empresa1'
 *      admin.ktagfinder.app     → tenantId = 'admin' (painel super admin)
 *      ktagfinder.app (apex)    → tenantId = APEX_TENANT (landing/placeholder)
 *      lock.ktagfinder.app      → reservado para instância externa; DNS deveria
 *                                 desviar, mas o app trata como reservado.
 *  - Em desenvolvimento (localhost/127.0.0.1):
 *      1. ?tenant=xxx na URL tem prioridade
 *      2. import.meta.env.VITE_DEV_TENANT
 *      3. fallback 'dev-tenant'
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
  'lock',
];

export const DEFAULT_DEV_TENANT = 'dev-tenant';

// Sentinel para indicar que o host é o apex (sem subdomínio).
// Usado pelo TenantContext para renderizar a landing/placeholder em vez de
// tentar carregar um documento de tenant.
export const APEX_TENANT = '__apex__';

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
    // domínio apex sem subdomínio (ktagfinder.app) — placeholder/landing.
    return APEX_TENANT;
  }

  return parts[0].toLowerCase();
}

export function isAdminPanelHost(hostname?: string): boolean {
  return getTenantFromHostname(hostname) === 'admin';
}

export function isApexHost(hostname?: string): boolean {
  return getTenantFromHostname(hostname) === APEX_TENANT;
}
