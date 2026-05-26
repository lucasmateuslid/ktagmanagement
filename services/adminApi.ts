/**
 * Wrappers tipados para as Cloud Functions usadas pelo painel super admin.
 * Centraliza httpsCallable + error normalization para que os hooks/páginas
 * fiquem livres de boilerplate.
 */
import { httpsCallable, type HttpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type {
  Tenant,
  TenantUsage,
  TenantDeletionMode,
  BillingCycle,
  BillingMethod,
  PlansConfigDoc,
  PlanConfig,
  SetupFeeStatus,
} from '../types';

function ensureFns() {
  if (!functions) throw new Error('Firebase Functions não inicializadas.');
  return functions;
}

function call<TIn, TOut>(name: string): HttpsCallable<TIn, TOut> {
  return httpsCallable<TIn, TOut>(ensureFns(), name);
}

// ----- Tenants core -----

export interface CreateTenantInput {
  slug: string;
  name: string;
  plan?: 'basic' | 'pro' | 'enterprise';
  active?: boolean;
  ownerEmail?: string;
  ownerName?: string;
}

export interface CreateTenantOutput {
  slug: string;
  ownerEmail: string | null;
  ownerPassword: string | null;
}

export const adminApi = {
  createTenant: (input: CreateTenantInput) =>
    call<CreateTenantInput, CreateTenantOutput>('createTenant')(input).then(r => r.data),

  setTenantActive: (slug: string, active: boolean) =>
    call<{ slug: string; active: boolean }, { slug: string; active: boolean }>('setTenantActive')({ slug, active }).then(r => r.data),

  updateTenant: (slug: string, patch: Partial<Pick<Tenant, 'name' | 'plan' | 'settings'>>) =>
    call<{ slug: string } & typeof patch, { slug: string; changed: boolean }>('updateTenant')({ slug, ...patch }).then(r => r.data),

  // ----- Fase 2 — usage / limits / delete / ranking -----

  getTenantUsage: (slug: string) =>
    call<{ slug: string }, { slug: string; usage: TenantUsage }>('getTenantUsage')({ slug }).then(r => r.data),

  updateTenantLimits: (slug: string, limits: { limiteTags?: number; limiteVeiculos?: number; maxUsers?: number }) =>
    call<{ slug: string } & typeof limits, { slug: string; changed: boolean; changes?: string[] }>('updateTenantLimits')({ slug, ...limits }).then(r => r.data),

  deleteTenant: (slug: string, mode: TenantDeletionMode, confirmName: string) =>
    call<{ slug: string; mode: TenantDeletionMode; confirmName: string }, { slug: string; mode: TenantDeletionMode; ok: boolean; usersDisabled?: number }>('deleteTenant')({ slug, mode, confirmName }).then(r => r.data),

  aggregateTenantsStats: () => call<{}, TenantsStatsResponse>('aggregateTenantsStats')({}).then(r => r.data),

  // ----- User management -----

  superAdminResetUserPassword: (tenantId: string, userId: string) =>
    call<{ tenantId: string; userId: string }, { userId: string; email: string; password: string }>('superAdminResetUserPassword')({ tenantId, userId }).then(r => r.data),

  // ----- Billing (já existentes, expostos aqui também) -----

  createTenantSubscription: (input: SubscriptionInput) =>
    call<SubscriptionInput, void>('createTenantSubscription')(input).then(r => r.data),

  updateTenantSubscription: (input: SubscriptionInput) =>
    call<SubscriptionInput, void>('updateTenantSubscription')(input).then(r => r.data),

  cancelTenantSubscription: (slug: string) =>
    call<{ slug: string }, void>('cancelTenantSubscription')({ slug }).then(r => r.data),

  syncTenantBilling: (slug: string) =>
    call<{ slug: string }, void>('syncTenantBilling')({ slug }).then(r => r.data),

  // ----- Plans config -----

  getPlansConfig: () =>
    call<{}, { plans: PlansConfigDoc; fromDefaults: boolean }>('getPlansConfig')({}).then(r => r.data),

  updatePlansConfig: (plans: Pick<PlansConfigDoc, 'basic' | 'pro' | 'enterprise'>) =>
    call<{ plans: typeof plans }, { ok: boolean; plans: PlansConfigDoc }>('updatePlansConfig')({ plans }).then(r => r.data),

  markSetupFeePaid: (slug: string) =>
    call<{ slug: string }, { ok: boolean; alreadyPaid: boolean }>('markSetupFeePaid')({ slug }).then(r => r.data),

  // ----- Acessos (identidade unificada) -----

  lookupIdentity: (email: string) =>
    call<{ email: string }, IdentityLookup>('superAdminLookupIdentity')({ email }).then(r => r.data),

  grantMembership: (input: GrantMembershipInput) =>
    call<GrantMembershipInput, GrantMembershipResult>('superAdminGrantMembership')(input).then(r => r.data),

  revokeMembership: (input: { tenantId: string; uid?: string; email?: string }) =>
    call<{ tenantId: string; uid?: string; email?: string }, { ok: boolean }>('superAdminRevokeMembership')(input).then(r => r.data),
};

export interface IdentityMembershipRow {
  tenantId: string;
  role: string;
  status: string;
}

export type IdentityLookup =
  | { found: false; email: string }
  | {
      found: true;
      uid: string;
      email: string;
      disabled: boolean;
      isGlobalAdmin: boolean;
      memberships: IdentityMembershipRow[];
    };

export interface GrantMembershipInput {
  email: string;
  tenantId: string;
  role: string;
  name?: string;
}

export interface GrantMembershipResult {
  uid: string;
  email: string;
  tenantId: string;
  role: string;
  created: boolean;
  tempPassword: string | null;
}

export interface SetupFeeInput {
  valueCents: number;
  status: SetupFeeStatus;
  description?: string;
  billingType?: BillingMethod;
}

export interface SubscriptionInput {
  slug: string;
  priceCents: number;
  cycle: BillingCycle;
  billingType: BillingMethod;
  dueDay: number;
  trialDays?: number;
  payer?: { name: string; email: string; cpfCnpj: string };
  setupFee?: SetupFeeInput;
}

export type { PlanConfig, PlansConfigDoc };

export interface RankedTenant {
  slug: string;
  name: string;
  plan: string;
  value: number;
  limit?: number;
}

export interface OverdueTenant {
  slug: string;
  name: string;
  plan: string;
  priceCents: number;
  nextDueDate?: number;
}

export interface ActiveTenant {
  slug: string;
  name: string;
  plan: string;
  lastActivityAt: number;
}

export interface TenantsStatsResponse {
  topByTags: RankedTenant[];
  topByVehicles: RankedTenant[];
  mostActive: ActiveTenant[];
  overdue: OverdueTenant[];
  growth: { month: string; count: number }[];
  totals: { tenants: number; active: number; deleted: number };
}

// Re-exporta para conveniência nos hooks.
export type { TenantDeletionMode, TenantUsage };
