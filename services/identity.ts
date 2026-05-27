/**
 * Camada de IDENTIDADE UNIFICADA (cliente).
 *
 * Um mesmo e-mail (= um único Firebase UID) pode pertencer a vários tenants
 * e/ou ser super admin da plataforma. Aqui lemos a identidade + memberships
 * do PRÓPRIO usuário para alimentar o seletor de empresa (TenantSwitcher) e a
 * tela de "sem acesso a esta empresa".
 *
 * Fontes (read-only para o cliente; escrita só via Admin SDK / Cloud Functions):
 *   /identities/{uid}                     → { isGlobalAdmin, email, ... }
 *   /identities/{uid}/memberships/{tid}   → { tenantId, role, status, ... }
 *
 * isGlobalAdmin é poder de PAINEL — NUNCA deve ser usado para liberar
 * permissões dentro do escopo de um tenant. Use exclusivamente para decidir se
 * o link do painel super admin aparece no seletor.
 */
import { getDoc, getDocs } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { identityDoc, membershipCollection } from '../lib/firestore';

export interface TenantMembership {
  tenantId: string;
  role: string;
  status: string;
  customRoleId?: string | null;
  email?: string;
}

export interface MyIdentity {
  uid: string;
  email: string;
  isGlobalAdmin: boolean;
  /** Apenas memberships APROVADAS — as únicas em que o usuário pode entrar. */
  memberships: TenantMembership[];
  /** Memberships pendentes (aguardando aprovação) — exibidas como informativo. */
  pending: TenantMembership[];
}

/**
 * Carrega a identidade do usuário autenticado. Tolerante a dados ausentes:
 * - Antes do backfill (migrateIdentities), memberships pode vir vazio mesmo
 *   havendo docs em /tenants/*\/users/*. Nesse caso, isGlobalAdmin ainda é
 *   derivado da claim `superadmin`.
 */
export async function loadMyIdentity(fbUser: FirebaseUser): Promise<MyIdentity> {
  const uid = fbUser.uid;

  // isGlobalAdmin: prioriza a claim (rápida, sem read) e cai no doc.
  let isGlobalAdmin = false;
  try {
    const token = await fbUser.getIdTokenResult();
    isGlobalAdmin = token.claims.superadmin === true;
  } catch { /* ignore */ }

  const memberships: TenantMembership[] = [];
  const pending: TenantMembership[] = [];
  try {
    const snap = await getDocs(membershipCollection(uid));
    snap.forEach((d) => {
      const m = d.data() as TenantMembership;
      const entry: TenantMembership = {
        tenantId: m.tenantId || d.id,
        role: m.role || 'user',
        status: m.status || 'pending',
        customRoleId: m.customRoleId ?? null,
        email: m.email,
      };
      if (entry.status === 'approved') memberships.push(entry);
      else pending.push(entry);
    });
  } catch { /* permission/offline — devolve listas vazias */ }

  if (!isGlobalAdmin) {
    try {
      const idSnap = await getDoc(identityDoc(uid));
      if (idSnap.exists() && idSnap.data()?.isGlobalAdmin === true) isGlobalAdmin = true;
    } catch { /* ignore */ }
  }

  return {
    uid,
    email: fbUser.email || '',
    isGlobalAdmin,
    memberships,
    pending,
  };
}
