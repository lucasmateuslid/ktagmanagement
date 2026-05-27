/**
 * Hook que assina a coleção `tenants` em tempo real e expõe filtros/ordenações
 * úteis para o painel super admin. Substitui o `useState + onSnapshot` repetido
 * em AdminTenants, AdminBilling, AdminDashboard.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Tenant } from '../types';

export type TenantFilter = 'all' | 'active' | 'inactive' | 'overdue' | 'no-billing' | 'deleted';

export interface UseTenantsOptions {
  /** Inclui tenants soft-deleted. Padrão false. */
  includeDeleted?: boolean;
  filter?: TenantFilter;
  search?: string;
}

export interface UseTenantsResult {
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  /** Total antes do filtro de busca (mas após includeDeleted). */
  total: number;
}

function matchSearch(t: Tenant, term: string): boolean {
  if (!term) return true;
  const low = term.toLowerCase();
  return (
    t.name?.toLowerCase().includes(low) ||
    t.slug?.toLowerCase().includes(low) ||
    t.billing?.payerEmail?.toLowerCase().includes(low) ||
    false
  );
}

function matchFilter(t: Tenant, filter: TenantFilter): boolean {
  switch (filter) {
    case 'all': return !t.deletedAt;
    case 'active': return t.active !== false && !t.deletedAt;
    case 'inactive': return t.active === false && !t.deletedAt;
    case 'overdue': return t.billing?.status === 'overdue' && !t.deletedAt;
    case 'no-billing': return (!t.billing || t.billing.status === 'none') && !t.deletedAt;
    case 'deleted': return !!t.deletedAt;
    default: return true;
  }
}

export function useTenants(options: UseTenantsOptions = {}): UseTenantsResult {
  const { includeDeleted = false, filter = 'all', search = '' } = options;
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError('Firestore não inicializado.');
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'tenants'),
      (snap) => {
        const list: Tenant[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTenants(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const visible = useMemo(() => {
    const base = includeDeleted ? tenants : tenants.filter(t => !t.deletedAt);
    const filtered = base.filter(t => matchFilter(t, filter));
    return filtered.filter(t => matchSearch(t, search));
  }, [tenants, includeDeleted, filter, search]);

  const total = useMemo(
    () => (includeDeleted ? tenants : tenants.filter(t => !t.deletedAt)).length,
    [tenants, includeDeleted],
  );

  return { tenants: visible, loading, error, total };
}
