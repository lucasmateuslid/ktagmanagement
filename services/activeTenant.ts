/**
 * Singleton em memória do tenant ativo.
 *
 * Por que existe: storage.ts tem ~50 métodos que hoje fazem
 * collection(db, KEYS.X). Mudar todos para receber tenantId como parâmetro
 * romperia 30+ páginas. Em vez disso, TenantContext popula este singleton uma
 * única vez no boot da app, e storage/firestore-helpers leem daqui.
 *
 * Limitações:
 *  - Não é reativo — se o tenant mudar em tempo de execução (impersonate
 *    do super admin no futuro), quem altera precisa chamar set() explicitamente
 *    e remontar o sub-árvore React relevante.
 *  - Lança erro se for lido antes de inicializar — força fail-fast em vez de
 *    silenciosamente cair em /tenants/undefined/...
 */

import type { Tenant } from '../types';

let _tenantId: string | null = null;
let _tenant: Tenant | null = null;

export const activeTenant = {
  set(tenantId: string, tenant?: Tenant | null) {
    _tenantId = tenantId;
    _tenant = tenant ?? null;
  },

  get id(): string {
    if (!_tenantId) {
      throw new Error(
        'activeTenant não inicializado. TenantProvider precisa rodar antes de qualquer chamada a storage.'
      );
    }
    return _tenantId;
  },

  get tenant(): Tenant | null {
    return _tenant;
  },

  isReady(): boolean {
    return _tenantId !== null;
  },

  clear() {
    _tenantId = null;
    _tenant = null;
  },
};
