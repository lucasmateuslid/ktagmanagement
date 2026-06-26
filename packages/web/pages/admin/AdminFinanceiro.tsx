import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { CreditCard, Receipt, LayoutDashboard, Building2, AlertTriangle, Wallet, Tag as TagIcon } from 'lucide-react';
import { Tabs } from '../../components/ui/tabs';
import { useTenants } from '../../hooks/useTenants';
import { FinancialSummary } from './billing/FinancialSummary';
import { Skeleton, SkeletonRows } from '../../components/ui/skeleton';
import { AdminBilling } from './AdminBilling';
import { AdminInvoices } from './AdminInvoices';
import { ContasPanel } from './finance/ContasPanel';
import { monthlyEquivFactor } from '../../lib/billing';
import { adminApi } from '../../services/adminApi';
import type { Tenant } from '../../types';

const fmtBRL = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type TabKey = 'dashboard' | 'assinaturas' | 'faturas' | 'contas';

export const AdminFinanceiro = () => {
  const [tab, setTab] = useState<TabKey>('dashboard');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Financeiro</h1>
        <p className="text-zinc-500 text-sm mt-1">Visão consolidada de assinaturas, faturas e saúde financeira</p>
      </header>

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} />, content: <FinanceiroDashboard /> },
          { key: 'assinaturas', label: 'Assinaturas', icon: <CreditCard size={15} />, content: <AdminBilling /> },
          { key: 'faturas', label: 'Faturas', icon: <Receipt size={15} />, content: <AdminInvoices /> },
          { key: 'contas', label: 'Contas', icon: <Wallet size={15} />, content: <ContasPanel /> },
        ]}
      />
    </div>
  );
};

const FinanceiroDashboard = () => {
  const { tenants, loading } = useTenants();
  const [monthRevenueCents, setMonthRevenueCents] = useState<number | null>(null);
  const [asaasBalance, setAsaasBalance] = useState<{ balanceCents: number; env: string } | null>(null);

  useEffect(() => {
    if (!functions) return;
    const fn = httpsCallable<any, { history: { month: string; revenueCents: number }[] }>(functions, 'aggregateMRRHistory');
    fn({ months: 1 }).then(res => {
      const history = res.data?.history || [];
      setMonthRevenueCents(history[history.length - 1]?.revenueCents ?? 0);
    }).catch(e => {
      console.error('aggregateMRRHistory failed', e);
      setMonthRevenueCents(0);
    });
  }, []);

  useEffect(() => {
    adminApi.getAsaasBalance()
      .then(d => setAsaasBalance({ balanceCents: d.balanceCents, env: d.env }))
      .catch(() => setAsaasBalance({ balanceCents: 0, env: 'erro' }));
  }, []);

  const stats = useMemo(() => {
    const withBilling = tenants.filter(t => t.billing && t.billing.status !== 'none' && !t.deletedAt);
    const overdue = withBilling.filter(t => t.billing?.status === 'overdue');
    const delinquencyRate = withBilling.length > 0 ? (overdue.length / withBilling.length) * 100 : 0;
    return {
      totalTenants: tenants.filter(t => !t.deletedAt).length,
      overdueCount: overdue.length,
      delinquencyRate,
    };
  }, [tenants]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardTile
          label="Saldo Asaas"
          icon={<Wallet size={16} className="text-emerald-400" />}
          value={asaasBalance === null ? null : fmtBRL(asaasBalance.balanceCents)}
          subtitle={asaasBalance ? (asaasBalance.env === 'sandbox' ? 'Ambiente sandbox' : 'Ambiente produção') : 'Consultando conta…'}
        />
        <DashboardTile
          label="Receita do mês"
          icon={<CreditCard size={16} className="text-amber-400" />}
          value={monthRevenueCents === null ? null : fmtBRL(monthRevenueCents)}
          subtitle="Faturas recebidas/confirmadas no mês corrente"
        />
        <DashboardTile
          label="Empresas totais"
          icon={<Building2 size={16} className="text-blue-400" />}
          value={loading ? null : String(stats.totalTenants)}
          subtitle="Tenants ativos no sistema"
        />
        <DashboardTile
          label="Taxa de inadimplência"
          icon={<AlertTriangle size={16} className="text-red-400" />}
          value={loading ? null : `${stats.delinquencyRate.toFixed(1)}%`}
          subtitle={`${stats.overdueCount} empresa${stats.overdueCount === 1 ? '' : 's'} em atraso`}
        />
      </section>

      <FinancialSummary tenants={tenants} loading={loading} />

      <TagUsageTable tenants={tenants} loading={loading} />
    </div>
  );
};

const TagUsageTable = ({ tenants, loading }: { tenants: Tenant[]; loading: boolean }) => {
  const rows = useMemo(() => {
    return tenants
      .filter(t => !t.deletedAt)
      .map(t => {
        const limit = t.settings?.limiteTags ?? 0;
        const used = t.usage?.tagsUtilizadas ?? 0;
        const usagePct = limit > 0 ? (used / limit) * 100 : null;
        const monthlyPriceCents = (t.billing?.priceCents ?? 0) * monthlyEquivFactor(t.billing?.cycle);
        const valuePerTagCents = used > 0 ? monthlyPriceCents / used : null;
        return { tenant: t, limit, used, usagePct, valuePerTagCents };
      })
      .sort((a, b) => (b.usagePct ?? -1) - (a.usagePct ?? -1));
  }, [tenants]);

  return (
    <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
        <TagIcon size={15} className="text-amber-500" />
        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Uso de tags por empresa</h2>
      </div>
      {loading ? (
        <div className="p-5"><SkeletonRows rows={5} cols={4} /></div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 text-sm">Nenhuma empresa cadastrada</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
              <tr>
                <th className="text-left px-5 py-3">Empresa</th>
                <th className="text-left px-5 py-3">Tags usadas / limite</th>
                <th className="text-left px-5 py-3">% do limite</th>
                <th className="text-left px-5 py-3">Valor por tag/mês</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ tenant, limit, used, usagePct, valuePerTagCents }) => (
                <tr key={tenant.id} className="border-t border-white/5">
                  <td className="px-5 py-3">
                    <div className="font-bold text-xs">{tenant.name}</div>
                    <code className="text-amber-500 text-[10px]">{tenant.slug}</code>
                  </td>
                  <td className="px-5 py-3 font-mono text-zinc-300 text-xs">
                    {used} / {limit > 0 ? limit : 'ilimitado'}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {usagePct === null ? <span className="text-zinc-600">—</span> : (
                      <span className={usagePct >= 90 ? 'text-red-400 font-bold' : usagePct >= 70 ? 'text-amber-400' : 'text-zinc-300'}>
                        {usagePct.toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-zinc-300 text-xs">
                    {valuePerTagCents === null ? <span className="text-zinc-600">—</span> : fmtBRL(valuePerTagCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const DashboardTile = ({
  label, value, subtitle, icon,
}: { label: string; value: string | null; subtitle: string; icon: React.ReactNode }) => (
  <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-5 overflow-hidden">
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">{label}</span>
        {icon}
      </div>
      {value === null
        ? <Skeleton w={120} h={32} rounded="lg" />
        : <div className="font-display text-xl md:text-2xl font-black">{value}</div>}
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5 truncate">{subtitle}</div>
    </div>
  </div>
);
