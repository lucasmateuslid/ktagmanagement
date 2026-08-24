import * as React from 'react';
import { useState } from 'react';
import {
  CreditCard, Search, AlertTriangle, CheckCircle2, CircleSlash, TrendingUp, Plug, Filter,
} from 'lucide-react';
import type { Tenant } from '../../types';
import { TenantBillingDetail } from './TenantBillingDetail';
import { FinancialSummary } from './billing/FinancialSummary';
import { useTenants } from '../../hooks/useTenants';
import { Select, type SelectOption } from '../../components/ui/select';
import { Skeleton, SkeletonRows } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../../services/adminApi';

const fmtBRL = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('pt-BR') : '—';

type StatusFilter = 'all' | 'active' | 'trialing' | 'overdue' | 'canceled' | 'none';

const STATUS_OPTIONS: SelectOption<StatusFilter>[] = [
  { value: 'all', label: 'Todos status' },
  { value: 'active', label: 'Em dia', icon: <CheckCircle2 size={13} /> },
  { value: 'trialing', label: 'Em trial', icon: <TrendingUp size={13} /> },
  { value: 'overdue', label: 'Inadimplentes', icon: <AlertTriangle size={13} /> },
  { value: 'canceled', label: 'Cancelados', icon: <CircleSlash size={13} /> },
  { value: 'none', label: 'Sem assinatura', icon: <Plug size={13} /> },
];

export const AdminBilling = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { tenants, loading } = useTenants({ search });
  const [selected, setSelected] = useState<Tenant | null>(null);

  React.useEffect(() => {
    // A visão administrativa deve refletir o Asaas a cada abertura.
    adminApi.syncAllTenantsBilling().catch(error => console.warn('automatic billing sync failed', error));
  }, []);

  const filtered = React.useMemo(() => {
    if (statusFilter === 'all') return tenants;
    return tenants.filter(t => {
      const s = t.billing?.status || 'none';
      return s === statusFilter;
    });
  }, [tenants, statusFilter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest">Mensalidades</h1>
          <p className="text-zinc-500 text-sm mt-1">Assinaturas, faturas e cobrança via Asaas</p>
        </div>
      </header>

      <FinancialSummary tenants={tenants} loading={loading} />

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou email do pagador…"
            className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder:text-zinc-600 outline-none transition-colors"
          />
        </div>
        <div className="w-full md:w-56">
          <Select<StatusFilter>
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            leftIcon={<Filter size={14} />}
          />
        </div>
      </div>

      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} cols={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <CreditCard className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-widest">
              {tenants.length === 0 ? 'Nenhuma empresa cadastrada' : 'Nenhuma empresa no filtro atual'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
                  <tr>
                    <th className="text-left px-5 py-3.5">Empresa</th>
                    <th className="text-left px-5 py-3.5">Plano</th>
                    <th className="text-left px-5 py-3.5">Valor</th>
                    <th className="text-left px-5 py-3.5">Ciclo</th>
                    <th className="text-left px-5 py-3.5">Próx. vencimento</th>
                    <th className="text-left px-5 py-3.5">Status</th>
                    <th className="text-right px-5 py-3.5">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {filtered.map((t) => (
                      <motion.tr
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="border-t border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => setSelected(t)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 text-xs">
                              {t.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold">{t.name}</div>
                              <code className="text-amber-500 text-[11px]">{t.slug}</code>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><PlanBadge plan={t.plan} /></td>
                        <td className="px-5 py-3.5 font-mono text-zinc-200">
                          {t.billing?.priceCents ? fmtBRL(t.billing.priceCents) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-400 text-xs uppercase tracking-widest">
                          {t.billing?.cycle ? <CycleBadge cycle={t.billing.cycle} /> : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-400 text-xs">
                          {fmtDate(t.billing?.nextDueDate)}
                        </td>
                        <td className="px-5 py-3.5">
                          <BillingStatusBadge status={t.billing?.status || 'none'} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(t); }}
                            className="text-xs font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400 px-3 py-1.5 rounded-xl hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-colors"
                          >
                            Gerenciar
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/5">
              <AnimatePresence initial={false}>
                {filtered.map(t => (
                  <motion.button
                    key={t.id}
                    layout
                    type="button"
                    onClick={() => setSelected(t)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="block w-full text-left p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 text-sm shrink-0">
                          {t.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold truncate">{t.name}</div>
                          <code className="text-amber-500 text-[11px]">{t.slug}</code>
                        </div>
                      </div>
                      <BillingStatusBadge status={t.billing?.status || 'none'} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-zinc-300">
                        {t.billing?.priceCents ? fmtBRL(t.billing.priceCents) : '—'}
                        {t.billing?.cycle && <span className="text-zinc-600 ml-1">/ {cycleLabel(t.billing.cycle)}</span>}
                      </span>
                      <span className="text-zinc-500">Próx: {fmtDate(t.billing?.nextDueDate)}</span>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {selected && (
        <TenantBillingDetail
          tenant={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

const PlanBadge = ({ plan }: { plan?: string }) => {
  const tone = plan === 'enterprise' ? 'purple' : plan === 'pro' ? 'blue' : 'neutral';
  return <Badge tone={tone as any}>{plan || 'basic'}</Badge>;
};

function cycleLabel(c?: string): string {
  switch (c) {
    case 'MONTHLY': return 'mensal';
    case 'QUARTERLY': return 'trimestral';
    case 'YEARLY': return 'anual';
    default: return c?.toLowerCase() || '';
  }
}

const CycleBadge = ({ cycle }: { cycle: string }) => {
  const labels: Record<string, string> = {
    MONTHLY: 'Mensal',
    QUARTERLY: 'Trimestral',
    YEARLY: 'Anual',
  };
  return <span className="text-[10px] font-mono text-zinc-300 normal-case">{labels[cycle] || cycle}</span>;
};

export const BillingStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; tone: 'emerald' | 'red' | 'blue' | 'zinc' | 'amber'; Icon: any }> = {
    active: { label: 'Em dia', tone: 'emerald', Icon: CheckCircle2 },
    overdue: { label: 'Inadimplente', tone: 'red', Icon: AlertTriangle },
    trialing: { label: 'Trial', tone: 'blue', Icon: TrendingUp },
    canceled: { label: 'Cancelada', tone: 'zinc', Icon: CircleSlash },
    none: { label: 'Sem plano', tone: 'amber', Icon: Plug },
  };
  const cfg = map[status] || map.none;
  return <Badge tone={cfg.tone} icon={<cfg.Icon size={11} />}>{cfg.label}</Badge>;
};
