import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { systemCollection } from '../../lib/firestore';
import {
  Building2, CheckCircle2, XCircle, Shield, TrendingUp, AlertTriangle, CreditCard, Sparkles,
  ArrowUpRight, Receipt, Activity, Crown, Tag as TagIcon, Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import type { Tenant } from '../../types';
import { useTenantsStats } from '../../hooks/useTenantsStats';
import { UsageBadge } from '../../components/ui/progress-bar';
import { Skeleton } from '../../components/ui/skeleton';
import { useAdminTheme } from '../../hooks/useAdminTheme';

interface Counts {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  superAdmins: number;
  mrrCents: number;
  overdueTenants: number;
  noBillingTenants: number;
}

interface HistoryPoint {
  month: string;
  revenueCents: number;
  invoicesCount: number;
  paidTenants: number;
}

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtBRLShort = (cents: number) => {
  const v = cents / 100;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const monthLabel = (key: string) => {
  const [, m] = key.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return names[Number(m) - 1] || m;
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

export const AdminDashboard = () => {
  const { theme } = useAdminTheme();
  const isLight = theme === 'light';

  const [counts, setCounts] = useState<Counts>({
    totalTenants: 0,
    activeTenants: 0,
    inactiveTenants: 0,
    superAdmins: 0,
    mrrCents: 0,
    overdueTenants: 0,
    noBillingTenants: 0,
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const { stats: tenantStats, loading: statsLoading } = useTenantsStats();

  useEffect(() => {
    if (!db) return;
    let cancelled = false;

    (async () => {
      const adminsSnap = await getDocs(systemCollection('system_admins'));
      if (cancelled) return;
      setCounts(c => ({ ...c, superAdmins: adminsSnap.size }));
    })();

    const unsub = onSnapshot(collection(db, 'tenants'), (snap) => {
      const list: Tenant[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTenants(list);

      let active = 0, inactive = 0, mrr = 0, overdue = 0, noBilling = 0;
      for (const t of list) {
        if (t.active === false) inactive++;
        else active++;
        const b = t.billing;
        if (!b || b.status === 'none') noBilling++;
        else if (b.status === 'overdue') overdue++;
        if (b && (b.status === 'active' || b.status === 'overdue')) {
          mrr += monthlyEquivalent(b.priceCents, b.cycle);
        }
      }
      setCounts(c => ({
        ...c,
        totalTenants: list.length,
        activeTenants: active,
        inactiveTenants: inactive,
        mrrCents: mrr,
        overdueTenants: overdue,
        noBillingTenants: noBilling,
      }));
      setLoading(false);
    });

    return () => { cancelled = true; unsub(); };
  }, []);

  useEffect(() => {
    if (!functions) return;
    let cancelled = false;
    (async () => {
      try {
        const fn = httpsCallable<any, { history: HistoryPoint[] }>(functions, 'aggregateMRRHistory');
        const res = await fn({ months: 12 });
        if (!cancelled) setHistory(res.data.history || []);
      } catch (e) {
        console.error('aggregateMRRHistory failed', e);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const recent = useMemo(() => tenants.slice(0, 5), [tenants]);

  const planDistribution = useMemo(() => {
    const map: Record<string, number> = { basic: 0, pro: 0, enterprise: 0 };
    for (const t of tenants) map[t.plan || 'basic'] = (map[t.plan || 'basic'] || 0) + 1;
    const total = tenants.length || 1;
    return Object.entries(map).map(([plan, count]) => ({
      plan,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [tenants]);

  const last3Months = useMemo(() => {
    const recent = history.slice(-3);
    const sum = recent.reduce((a, p) => a + p.revenueCents, 0);
    return { sum, points: recent };
  }, [history]);

  const trend = useMemo(() => {
    if (history.length < 2) return 0;
    const last = history[history.length - 1]?.revenueCents || 0;
    const prev = history[history.length - 2]?.revenueCents || 0;
    if (prev === 0) return last > 0 ? 100 : 0;
    return Math.round(((last - prev) / prev) * 100);
  }, [history]);

  // Paleta do gráfico — adapta ao tema
  const chart = isLight
    ? {
        grid: '#e2e8f0',
        axisMain: '#64748b',
        axisSecondary: '#94a3b8',
        stroke: '#d97706',
        fillTop: 0.28,
        tooltipBg: '#ffffff',
        tooltipBorder: '#e2e8f0',
        tooltipText: '#0f172a',
        tooltipLabel: '#475569',
        tooltipShadow: '0 10px 30px -10px rgba(15,23,42,0.15)',
      }
    : {
        grid: '#27272a',
        axisMain: '#71717a',
        axisSecondary: '#52525b',
        stroke: '#f59e0b',
        fillTop: 0.4,
        tooltipBg: 'rgba(9, 9, 11, 0.95)',
        tooltipBorder: 'rgba(245, 158, 11, 0.2)',
        tooltipText: '#ffffff',
        tooltipLabel: '#a1a1aa',
        tooltipShadow: '0 10px 30px -10px rgba(0,0,0,0.6)',
      };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Visão geral da plataforma · {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link
          to="/admin/invoices"
          className="hidden md:inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300 px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
        >
          <Receipt size={13} /> Faturas globais
          <ArrowUpRight size={11} />
        </Link>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeroStat
          label="MRR"
          value={loading ? '—' : fmtBRL(counts.mrrCents)}
          delta={trend}
          subtitle="Receita recorrente"
          icon={TrendingUp}
          spark={history.map(h => h.revenueCents)}
          isLight={isLight}
        />
        <SoftStat label="Empresas" value={counts.totalTenants} icon={Building2} loading={loading} hint={`${counts.activeTenants} ativas`} />
        <SoftStat label="Em dia" value={counts.activeTenants} icon={CheckCircle2} loading={loading} tone="emerald" />
        <SoftStat label="Inadimplentes" value={counts.overdueTenants} icon={AlertTriangle} loading={loading} tone="red" link="/admin/billing" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Receita realizada</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 border border-white/10 rounded-full px-1.5 py-0.5">12 meses</span>
              </div>
              <div className="font-display text-3xl font-black">
                {historyLoading ? '—' : fmtBRL(last3Months.sum)}
                <span className="text-zinc-600 text-sm font-bold ml-2">últ. 3 meses</span>
              </div>
            </div>
            <Activity className="text-amber-500/60" size={18} />
          </div>
          <div className="h-64 -mx-2">
            {historyLoading ? (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest">Carregando histórico…</div>
            ) : history.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest">Sem dados ainda</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.stroke} stopOpacity={chart.fillTop} />
                      <stop offset="100%" stopColor={chart.stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthLabel}
                    tick={{ fill: chart.axisMain, fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => fmtBRLShort(v)}
                    tick={{ fill: chart.axisSecondary, fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ stroke: chart.stroke, strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{
                      background: chart.tooltipBg,
                      border: `1px solid ${chart.tooltipBorder}`,
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: chart.tooltipShadow,
                      color: chart.tooltipText,
                    }}
                    labelStyle={{ color: chart.tooltipLabel, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    formatter={(v: number, n) => n === 'revenueCents' ? [fmtBRL(v), 'Receita'] : [v, n]}
                    labelFormatter={monthLabel}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenueCents"
                    stroke={chart.stroke}
                    strokeWidth={2.5}
                    fill="url(#mrrFill)"
                    dot={false}
                    activeDot={{ r: 5, fill: chart.stroke, stroke: isLight ? '#fff' : '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <AlertCard
            label="Sem cobrança"
            value={counts.noBillingTenants}
            icon={CreditCard}
            color="text-amber-400"
            tint="bg-amber-500/5 border-amber-500/20"
            link="/admin/billing"
            hint="Empresas sem assinatura Asaas"
          />
          <AlertCard
            label="Inativas"
            value={counts.inactiveTenants}
            icon={XCircle}
            color="text-red-400"
            tint="bg-red-500/5 border-red-500/20"
            link="/admin/tenants"
          />
          <AlertCard
            label="Super admins"
            value={counts.superAdmins}
            icon={Shield}
            color="text-blue-400"
            tint="bg-blue-500/5 border-blue-500/20"
            link="/admin/system-admins"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-zinc-300">Cadastros recentes</h2>
            <Link to="/admin/tenants" className="text-[10px] font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400 inline-flex items-center gap-1">
              Ver todas <ArrowUpRight size={10} />
            </Link>
          </div>
          {loading ? (
            <div className="text-sm text-zinc-500 py-8 text-center">Carregando…</div>
          ) : recent.length === 0 ? (
            <div className="flex items-center justify-center gap-3 text-sm text-zinc-500 py-10">
              <Sparkles size={16} className="text-amber-500" />
              Nenhuma empresa cadastrada ainda. Comece em <Link to="/admin/tenants" className="text-amber-500">Empresas</Link>.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.map(t => (
                <li key={t.id} className="py-3 flex items-center justify-between text-sm gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 text-sm shrink-0">
                      {t.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{t.name}</div>
                      <code className="text-amber-500 text-[11px]">{t.slug}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${planBadgeCls(t.plan)}`}>
                      {t.plan || 'basic'}
                    </span>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 hidden sm:block">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={14} className="text-amber-500" />
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-zinc-300">Por plano</h2>
          </div>
          <div className="space-y-4">
            {planDistribution.map(p => (
              <div key={p.plan}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{p.plan}</span>
                  <span className="text-xs font-mono text-zinc-300">{p.count}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      p.plan === 'enterprise' ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500'
                      : p.plan === 'pro' ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      : 'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`}
                    style={{ width: `${p.pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">{p.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RankingCard
          title="Top empresas por tags"
          icon={<TagIcon size={14} />}
          loading={statsLoading}
          items={(tenantStats?.topByTags || []).map(t => ({
            slug: t.slug,
            name: t.name,
            plan: t.plan,
            primary: t.value,
            secondary: t.limit,
            unit: 'tags',
          }))}
          renderTrailing={(it) => it.secondary
            ? <UsageBadge value={it.primary} max={it.secondary} />
            : <span className="text-[11px] font-mono text-zinc-300">{it.primary.toLocaleString('pt-BR')} tags</span>}
        />

        <RankingCard
          title="Mais ativas"
          icon={<Activity size={14} />}
          loading={statsLoading}
          items={(tenantStats?.mostActive || []).map(t => ({
            slug: t.slug,
            name: t.name,
            plan: t.plan,
            primary: t.lastActivityAt,
          }))}
          renderTrailing={(it) => (
            <span className="text-[11px] font-mono text-zinc-400">
              {it.primary ? new Date(it.primary).toLocaleDateString('pt-BR') : '—'}
            </span>
          )}
        />

        <OverdueCard
          loading={statsLoading}
          items={tenantStats?.overdue || []}
        />
      </section>
    </div>
  );
};

interface RankingItem {
  slug: string;
  name: string;
  plan: string;
  primary: number;
  secondary?: number;
  unit?: string;
}

const RankingCard = ({
  title, icon, loading, items, renderTrailing,
}: {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  items: RankingItem[];
  renderTrailing: (it: RankingItem) => React.ReactNode;
}) => (
  <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5">
    <div className="flex items-center gap-2 mb-4">
      <Trophy size={14} className="text-amber-500" />
      <h2 className="font-display text-sm font-black uppercase tracking-widest text-zinc-300">{title}</h2>
    </div>
    {loading ? (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={36} rounded="lg" />)}
      </div>
    ) : items.length === 0 ? (
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 py-6 text-center inline-flex items-center justify-center gap-1.5 w-full">
        Sem dados ainda <span>{icon}</span>
      </div>
    ) : (
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((it, i) => (
          <li key={it.slug} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
            <span className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-black ${
              i === 0 ? 'bg-amber-500/20 text-amber-400' :
                i === 1 ? 'bg-zinc-700/40 text-zinc-300' :
                  i === 2 ? 'bg-orange-700/30 text-orange-300' :
                    'bg-white/[0.03] text-zinc-500'
            }`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{it.name}</div>
              <code className="text-[10px] text-amber-500/80">{it.slug}</code>
            </div>
            <div className="shrink-0 text-right">{renderTrailing(it)}</div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const OverdueCard = ({
  loading, items,
}: {
  loading: boolean;
  items: { slug: string; name: string; plan: string; priceCents: number; nextDueDate?: number }[];
}) => (
  <div className="bg-red-500/[0.04] border border-red-500/15 backdrop-blur-xl rounded-3xl p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-red-400" />
        <h2 className="font-display text-sm font-black uppercase tracking-widest text-red-400">Inadimplentes</h2>
      </div>
      <Link to="/admin/billing" className="text-[10px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-300 inline-flex items-center gap-1">
        Gerenciar <ArrowUpRight size={10} />
      </Link>
    </div>
    {loading ? (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={36} rounded="lg" />)}
      </div>
    ) : items.length === 0 ? (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="text-emerald-400" size={28} />
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Tudo em dia</p>
        <p className="text-[10px] text-zinc-500">Nenhuma empresa com fatura vencida</p>
      </div>
    ) : (
      <ul className="space-y-1.5">
        {items.slice(0, 5).map(t => (
          <li key={t.slug} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-red-500/5 transition-colors">
            <div className="w-7 h-7 shrink-0 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center text-red-400 font-display font-black text-[11px]">
              {t.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate text-zinc-200">{t.name}</div>
              {t.nextDueDate && (
                <div className="text-[10px] text-red-400/80">
                  Venceu em {new Date(t.nextDueDate).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
            <span className="shrink-0 text-[11px] font-mono text-red-300">
              {t.priceCents ? fmtBRL(t.priceCents) : '—'}
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

function planBadgeCls(plan?: string) {
  return plan === 'enterprise' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    : plan === 'pro' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    : 'bg-zinc-800/60 text-zinc-300 border-white/5';
}

const HeroStat = ({
  label, value, delta, subtitle, icon: Icon, spark, isLight,
}: { label: string; value: string; delta: number; subtitle: string; icon: any; spark: number[]; isLight: boolean }) => {
  const trendPositive = delta >= 0;
  return (
    <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
          <Icon className="text-amber-400" size={16} />
        </div>
        <div className="font-display text-2xl font-black text-amber-400">{value}</div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{subtitle}</div>
          <div className={`text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-0.5 ${trendPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trendPositive ? '↑' : '↓'} {Math.abs(delta)}%
          </div>
        </div>
        <Sparkline values={spark} className="mt-3" stroke={isLight ? '#d97706' : '#f59e0b'} fillOpacity={isLight ? 0.35 : 0.5} />
      </div>
    </div>
  );
};

const Sparkline = ({ values, className, stroke, fillOpacity }: { values: number[]; className?: string; stroke: string; fillOpacity: number }) => {
  if (!values || values.length < 2) return <div className={`h-8 ${className || ''}`} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const id = React.useId();
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full h-8 ${className || ''}`}>
      <defs>
        <linearGradient id={`sparkFill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#sparkFill-${id})`} />
    </svg>
  );
};

const SoftStat = ({
  label, value, icon: Icon, loading, tone, hint, link,
}: { label: string; value: number; icon: any; loading: boolean; tone?: 'emerald' | 'red'; hint?: string; link?: string }) => {
  const toneCls = tone === 'emerald' ? 'text-emerald-400'
    : tone === 'red' ? 'text-red-400'
    : 'text-zinc-200';
  const Card = (
    <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-3xl p-5 overflow-hidden transition-colors h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
        <Icon className={toneCls} size={16} />
      </div>
      <div className={`font-display text-2xl font-black ${toneCls}`}>
        {loading ? <span className="text-zinc-700">···</span> : value}
      </div>
      {hint && <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2">{hint}</div>}
    </div>
  );
  return link ? <Link to={link} className="block h-full">{Card}</Link> : Card;
};

const AlertCard = ({
  label, value, icon: Icon, color, tint, link, hint,
}: { label: string; value: number; icon: any; color: string; tint: string; link: string; hint?: string }) => (
  <Link to={link} className={`block rounded-3xl border ${tint} backdrop-blur-xl p-5 hover:bg-opacity-50 transition-colors`}>
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
      <Icon className={color} size={16} />
    </div>
    <div className={`font-display text-2xl font-black ${color}`}>{value}</div>
    {hint && <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-2">{hint}</div>}
  </Link>
);
