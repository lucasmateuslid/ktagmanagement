/**
 * Helpers de Firestore tenant-aware.
 *
 * Todos os acessos a coleções de domínio devem passar por aqui — assim, qualquer
 * tentativa acidental de tocar dados em /<coll-flat> em vez de /tenants/{id}/<coll>
 * é trivial de detectar (basta procurar usos diretos de `collection(db, ...)`
 * fora deste módulo).
 *
 * Coleções de sistema (que vivem fora do escopo do tenant) têm helpers próprios:
 *   - /tenants/{id}                    → tenantRootDoc
 *   - /system_admins/{uid}             → systemCollection('system_admins')
 *   - /push_subscriptions/{auto}       → systemCollection('push_subscriptions')
 */

import { collection, doc, CollectionReference, DocumentReference, Firestore } from 'firebase/firestore';
import { db } from '../services/firebase';
import { activeTenant } from '../services/activeTenant';

function requireDb(): Firestore {
  if (!db) {
    throw new Error('Firestore não inicializado (modo offline). Operação cancelada.');
  }
  return db;
}

/** Referência à coleção `/tenants/{activeTenantId}/{name}`. */
export function tenantCollection(name: string): CollectionReference {
  const firestore = requireDb();
  return collection(firestore, 'tenants', activeTenant.id, name);
}

/** Referência ao documento `/tenants/{activeTenantId}/{name}/{id}`. */
export function tenantDoc(name: string, id: string): DocumentReference {
  const firestore = requireDb();
  return doc(firestore, 'tenants', activeTenant.id, name, id);
}

/** Documento raiz do tenant ativo: `/tenants/{activeTenantId}`. */
export function activeTenantRootDoc(): DocumentReference {
  const firestore = requireDb();
  return doc(firestore, 'tenants', activeTenant.id);
}

/** Documento raiz de um tenant arbitrário (uso pelo TenantContext no boot). */
export function tenantRootDoc(tenantId: string): DocumentReference {
  const firestore = requireDb();
  return doc(firestore, 'tenants', tenantId);
}

/**
 * Espelho público do tenant: `/tenants/{tenantId}/public_settings/meta`.
 * Contém só { name, active, plan } — sem billing.* nem IDs do Asaas.
 * Legível sem auth (regra pública em /tenants/{...}/public_settings/{...}),
 * usado pelo TenantContext no boot pra checar existência + suspensão antes do login.
 */
export function tenantPublicMetaDoc(tenantId: string): DocumentReference {
  const firestore = requireDb();
  return doc(firestore, 'tenants', tenantId, 'public_settings', 'meta');
}

/**
 * Helper para coleções de sistema (fora do escopo de tenant).
 * Use com parcimônia — apenas para entidades que precisam ser cross-tenant
 * por design (lista de tenants, admins do sistema, push subscriptions, etc).
 */
export function systemCollection(name: string): CollectionReference {
  const firestore = requireDb();
  return collection(firestore, name);
}

export function systemDoc(name: string, id: string): DocumentReference {
  const firestore = requireDb();
  return doc(firestore, name, id);
}
