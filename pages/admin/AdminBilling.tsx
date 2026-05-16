import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Tenant } from '../../types';
import {
  CreditCard, Loader2, TrendingUp, AlertTriangle, CircleSlash, CheckCircle2, Plug,
} from 'lucide-react';
import { TenantBillingDetail } from './TenantBillingDetail';

const fmtBRL = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('pt-BR') : '—';

export const AdminBilling = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'tenants'), (snap) => {
      const list: Tenant[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTenants(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    let mrrCents = 0;
    let active = 0;
    let overdue = 0;
    let none = 0;
    let canceled = 0;

    for (const t of tenants) {
      const b = t.billing;
      if (!b || b.status === 'none') { none++; continue; }
      if (b.status === 'active' || b.status === 'overdue') {
        const monthly = monthlyEquivalent(b.priceCents, b.cycle);
        mrrCents += monthly;
      }
      if (b.status === 'active') active++;
      else if (b.status === 'overdue') overdue++;
      else if (b.status === 'canceled') canceled++;
    }
    return { mrrCents, active, overdue, none, canceled };
  }, [tenants]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest">Mensalidades</h1>
          <p className="text-zinc-500 text-sm mt-1">Assinaturas, faturas e cobrança via Asaas</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="MRR estimado"
          value={fmtBRL(stats.mrrCents)}
          icon={TrendingUp}
          color="text-amber-400"
          tint="from-amber-500/10 to-transparent"
        />
        <StatCard
          label="Em dia"
          value={String(stats.active)}
          icon={CheckCircle2}
          color="text-emerald-400"
          tint="from-emerald-500/10 to-transparent"
        />
        <StatCard
          label="Inadimplentes"
          value={String(stats.overdue)}
          icon={AlertTriangle}
          color="text-red-400"
          tint="from-red-500/10 to-transparent"
        />
        <StatCard
          label="Sem assinatura"
          value={String(stats.none)}
          icon={Plug}
          color="text-zinc-300"
          tint="from-white/5 to-transparent"
        />
      </div>

      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-zinc-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <CreditCard className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhuma empresa cadastrada</p>
          </div>
        ) : (
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
              {tenants.map((t) => (
                <tr
                  key={t.id}
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
                  <td className="px-5 py-3.5">
                    <PlanBadge plan={t.plan} />
                  </td>
                  <td className="px-5 py-3.5 font-mono text-zinc-200">
                    {t.billing?.priceCents ? fmtBRL(t.billing.priceCents) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 text-xs uppercase tracking-widest">
                    {t.billing?.cycle || <span className="text-zinc-600">—</span>}
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
                </tr>
              ))}
            </tbody>
          </table>
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

function monthlyEquivalent(priceCents?: number, cycle?: string): number {
  if (!priceCents) return 0;
  switch (cycle) {
    case 'YEARLY': return Math.round(priceCents / 12);
    case 'QUARTERLY': return Math.round(priceCents / 3);
    case 'MONTHLY':
    default: return priceCents;
  }
}

const StatCard = ({
  label, value, icon: Icon, color, tint,
}: { label: string; value: string; icon: any; color: string; tint: string }) => (
  <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 overflow-hidden">
    <div className={`absolute inset-0 bg-gradient-to-br ${tint} opacity-80 pointer-events-none`} />
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
        <Icon className={color} size={16} />
      </div>
      <div className={`font-display text-2xl font-black ${color}`}>{value}</div>
    </div>
  </div>
);

const PlanBadge = ({ plan }: { plan?: string }) => {
  const color = plan === 'enterprise' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    : plan === 'pro' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    : 'bg-zinc-700/40 text-zinc-300 border-zinc-700';
  return <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${color}`}>{plan || 'basic'}</span>;
};

export const BillingStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    active: { label: 'Em dia', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', Icon: CheckCircle2 },
    overdue: { label: 'Inadimplente', cls: 'bg-red-500/10 text-red-400 border-red-500/20', Icon: AlertTriangle },
    trialing: { label: 'Trial', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', Icon: TrendingUp },
    canceled: { label: 'Cancelada', cls: 'bg-zinc-700/40 text-zinc-300 border-zinc-700', Icon: CircleSlash },
    none: { label: 'Sem plano', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', Icon: Plug },
  };
  const cfg = map[status] || map.none;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};
