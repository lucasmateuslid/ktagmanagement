/**
 * Wrappers tipados para as Cloud Functions usadas pelo painel super admin.
 * Centraliza httpsCallable + error normalization para que os hooks/páginas
 * fiquem livres de boilerplate.
 */
import { httpsCallable, type HttpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { authenticatedFetch } from './authenticatedFetch';
import type {
  Tenant,
  TenantUsage,
  TenantDeletionMode,
  BillingCycle,
  BillingMethod,
  PlansConfigDoc,
  PlanConfig,
  SetupFeeStatus,
  ExpenseCategory,
  Expense,
  ExpenseType,
  ExpenseStatus,
} from '../types';

function ensureFns() {
  if (!functions) throw new Error('Firebase Functions não inicializadas.');
  return functions;
}

function call<TIn, TOut>(name: string): HttpsCallable<TIn, TOut> {
  return httpsCallable<TIn, TOut>(ensureFns(), name);
}

export interface TenantUserRow {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  status: string;
  createdAt: number;
}

export interface TenantMembershipRow {
  uid: string;
  email: string | null;
  role: string;
  status: string;
  isGlobalAdmin: boolean;
}

// ----- Tenants core -----

export interface CreateTenantBillingInput {
  priceCents: number;
  cycle?: BillingCycle;
  billingType?: BillingMethod;
  dueDay?: number;
  trialDays?: number;
  payer: { name: string; email: string; cpfCnpj: string; phone?: string };
  setupFee?: { valueCents: number; status: SetupFeeStatus; description?: string; billingType?: BillingMethod };
}

export interface CreateTenantInput {
  slug: string;
  name: string;
  plan?: 'basic' | 'pro' | 'enterprise';
  active?: boolean;
  ownerEmail?: string;
  ownerName?: string;
  billing?: CreateTenantBillingInput;
  logoBase64Light?: string;
  logoBase64Dark?: string;
}

export interface CreateTenantOutput {
  slug: string;
  ownerEmail: string | null;
  ownerPassword: string | null;
  billing?: Tenant['billing'] | null;
  billingError?: string | null;
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

  updateTenantLimits: async (slug: string, limits: { limiteTags?: number; limiteVeiculos?: number; maxUsers?: number; features?: string[] | null }) => {
    const response = await authenticatedFetch(`/api/admin/tenants/${encodeURIComponent(slug)}/limits`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(limits),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Falha HTTP ${response.status}.`);
    return data as { slug: string; changed: boolean; changes?: string[] };
  },

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

  getAsaasBalance: () =>
    call<{}, { balanceCents: number; balanceReal: number; env: string }>('getAsaasBalance')({}).then(r => r.data),

  syncAllTenantsBilling: () =>
    call<{}, { synced: number; errors: string[]; total: number }>('syncAllTenantsBilling')({}).then(r => r.data),

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

  // ----- Usuários por tenant -----

  listAllUsers: (tenantId?: string) =>
    call<{ tenantId?: string }, { users: TenantUserRow[] }>('listAllUsers')({ tenantId }).then(r => r.data),

  listTenantMemberships: (tenantId: string) =>
    call<{ tenantId: string }, { memberships: TenantMembershipRow[] }>('listTenantMemberships')({ tenantId }).then(r => r.data),

  // ----- Contas a pagar/receber -----

  listExpenseCategories: () =>
    call<{}, { categories: ExpenseCategory[] }>('listExpenseCategories')({}).then(r => r.data),

  upsertExpenseCategory: (input: { id?: string; label: string; color?: string }) =>
    call<typeof input, { categories: ExpenseCategory[] }>('upsertExpenseCategory')(input).then(r => r.data),

  deleteExpenseCategory: (id: string) =>
    call<{ id: string }, { categories: ExpenseCategory[] }>('deleteExpenseCategory')({ id }).then(r => r.data),

  listExpenses: (filter?: { type?: ExpenseType; status?: ExpenseStatus; categoryId?: string; limit?: number }) =>
    call<typeof filter, { expenses: Expense[] }>('listExpenses')(filter || {}).then(r => r.data),

  createExpense: (input: { categoryId?: string | null; description: string; amountCents: number; type: ExpenseType; dueDate?: number; notes?: string }) =>
    call<typeof input, Expense>('createExpense')(input).then(r => r.data),

  updateExpense: (input: { id: string; categoryId?: string | null; description?: string; amountCents?: number; dueDate?: number | null; notes?: string | null; status?: ExpenseStatus }) =>
    call<typeof input, { id: string; changed: boolean }>('updateExpense')(input).then(r => r.data),

  deleteExpense: (id: string) =>
    call<{ id: string }, { id: string; deleted: boolean }>('deleteExpense')({ id }).then(r => r.data),
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
