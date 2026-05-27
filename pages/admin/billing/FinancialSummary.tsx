import * as React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Calendar, Repeat, DollarSign, BarChart3, AlertTriangle,
} from 'lucide-react';
import type { Tenant } from '../../../types';
import { Skeleton } from '../../../components/ui/skeleton';

interface FinancialSummaryProps {
  tenants: Tenant[];
  loading?: boolean;
}

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

function monthlyEquivalent(priceCents?: number, cycle?: string): number {
  if (!priceCents) return 0;
  switch (cycle) {
    case 'YEARLY': return Math.round(priceCents / 12);
    case 'QUARTERLY': return Math.round(priceCents / 3);
    case 'MONTHLY':
    default: return priceCents;
  }
}

/**
 * Painel financeiro agregado — mostra próximos vencimentos, MRR projetado,
 * receita anual estimada e taxa de cancelamento (churn) do mês corrente.
 */
export const FinancialSummary = ({ tenants, loading }: FinancialSummaryProps) => {
  const summary = React.useMemo(() => {
    let mrrCents = 0;
    let activeCount = 0;
    let canceledThisMonth = 0;
    let activeAtMonthStart = 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const upcoming: { tenant: Tenant; dueDateMs: number; valueCents: number }[] = [];

    for (const t of tenants) {
      const b = t.billing;
      if (!b || b.status === 'none' || t.deletedAt) continue;

      // MRR e contagem só de status ativo/overdue
      if (b.status === 'active' || b.status === 'overdue') {
        mrrCents += monthlyEquivalent(b.priceCents, b.cycle);
        activeCount++;
      }

      // Churn — assinaturas canceladas durante o mês corrente.
      // Aproxima usando `lastSyncedAt` + status=canceled (Asaas webhook atualiza).
      if (b.status === 'canceled' && b.lastSyncedAt && b.lastSyncedAt >= monthStart) {
        canceledThisMonth++;
      }
      // Estima ativos no início do mês: ativos atuais + cancelados no período.
      if (b.status === 'active' || b.status === 'overdue' || b.status === 'canceled') {
        activeAtMonthStart++;
      }

      // Próximos vencimentos (30 dias)
      if (b.nextDueDate && b.nextDueDate > Date.now() && b.nextDueDate < Date.now() + 30 * 86400000) {
        upcoming.push({
          tenant: t,
          dueDateMs: b.nextDueDate,
          valueCents: b.priceCents || 0,
        });
      }
    }

    upcoming.sort((a, b) => a.dueDateMs - b.dueDateMs);
    const next = upcoming[0];
    const next7Days = upcoming.filter(u => u.dueDateMs < Date.now() + 7 * 86400000);
    const next7DaysSum = next7Days.reduce((acc, u) => acc + u.valueCents, 0);

    const annualEstimate = mrrCents * 12;
    const churnRate = activeAtMonthStart > 0 ? (canceledThisMonth / activeAtMonthStart) * 100 : 0;

    return {
      mrrCents,
      annualEstimate,
      activeCount,
      next,
      upcoming,
      next7Days,
      next7DaysSum,
      churnRate,
      canceledThisMonth,
    };
  }, [tenants]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {/* Próxima cobrança destacada */}
      <SummaryCard
        label="Próxima cobrança"
        icon={<Calendar size={16} />}
        tone="amber"
        loading={loading}
        value={summary.next ? fmtDate(summary.next.dueDateMs) : 'Nenhuma'}
        subtitle={summary.next ? `${summary.next.tenant.name} · ${fmtBRL(summary.next.valueCents)}` : 'nenhuma agendada'}
      />

      <SummaryCard
        label="Próximos 7 dias"
        icon={<TrendingUp size={16} />}
        tone="emerald"
        loading={loading}
        value={fmtBRL(summary.next7DaysSum)}
        subtitle={`${summary.next7Days.length} ${summary.next7Days.length === 1 ? 'fatura' : 'faturas'} a receber`}
      />

      <SummaryCard
        label="Receita mensal (MRR)"
        icon={<Repeat size={16} />}
        tone="blue"
        loading={loading}
        value={fmtBRL(summary.mrrCents)}
        subtitle={`${summary.activeCount} ${summary.activeCount === 1 ? 'assinatura ativa' : 'assinaturas ativas'}`}
      />

      <SummaryCard
        label="Projeção anual"
        icon={<BarChart3 size={16} />}
        tone="purple"
        loading={loading}
        value={fmtBRL(summary.annualEstimate)}
        subtitle="MRR × 12 (sem crescimento)"
      />

      {summary.churnRate > 0 && (
        <SummaryCard
          label="Taxa de cancelamento"
          icon={<AlertTriangle size={16} />}
          tone="red"
          loading={loading}
          value={`${summary.churnRate.toFixed(1)}%`}
          subtitle={`${summary.canceledThisMonth} ${summary.canceledThisMonth === 1 ? 'cancelamento' : 'cancelamentos'} este mês`}
        />
      )}
    </motion.section>
  );
};

const SummaryCard = ({
  label, value, subtitle, icon, tone, loading,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: 'amber' | 'emerald' | 'blue' | 'purple' | 'red';
  loading?: boolean;
}) => {
  const toneCls = {
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
  }[tone];

  const gradient = {
    amber: 'from-amber-500/10',
    emerald: 'from-emerald-500/10',
    blue: 'from-blue-500/10',
    purple: 'from-purple-500/10',
    red: 'from-red-500/10',
  }[tone];

  return (
    <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-5 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} to-transparent pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">{label}</span>
          <span className={toneCls}>{icon}</span>
        </div>
        {loading
          ? <Skeleton w={120} h={32} rounded="lg" />
          : <div className={`font-display text-xl md:text-2xl font-black ${toneCls} truncate`}>{value}</div>}
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5 truncate">{subtitle}</div>
      </div>
    </div>
  );
};
