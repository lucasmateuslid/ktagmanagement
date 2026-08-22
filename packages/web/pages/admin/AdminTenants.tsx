import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Tenant, TenantDeletionMode } from '../../types';
import {
  Building2, Plus, Power, ExternalLink, Loader2, Copy, CreditCard, Crown, Rocket, Zap,
  MoreVertical, Search, Trash2, Settings2, RefreshCw, Activity, AlertTriangle, TrendingUp, Tag as TagIcon,
  Eye, X,
} from 'lucide-react';
import { BillingStatusBadge } from './AdminBilling';
import { Select, type SelectOption } from '../../components/ui/select';
import { DropdownMenu, type DropdownItem } from '../../components/ui/dropdown-menu';
import { ConfirmStrongModal } from '../../components/ui/confirm-strong-modal';
import { ProgressBar, UsageBadge } from '../../components/ui/progress-bar';
import { Badge } from '../../components/ui/badge';
import { Skeleton, SkeletonRows } from '../../components/ui/skeleton';
import { BottomSheet } from '../../components/ui/bottom-sheet';
import { CurrencyInput } from '../../components/ui/currency-input';
import { useTenants, type TenantFilter } from '../../hooks/useTenants';
import { useTenantsStats } from '../../hooks/useTenantsStats';
import { adminApi } from '../../services/adminApi';
import { motion, AnimatePresence } from 'framer-motion';
import { MODULE_CATALOG } from '../../../../constants/moduleCatalog';
import { BUSINESS_MODULE_IDS } from '@ktag/shared';


const PLAN_OPTIONS: SelectOption<'basic' | 'pro' | 'enterprise'>[] = [
  { value: 'basic', label: 'Basic', description: 'Recursos essenciais', icon: <Zap size={14} /> },
  { value: 'pro', label: 'Pro', description: 'Mais limites e integrações', icon: <Rocket size={14} /> },
  { value: 'enterprise', label: 'Enterprise', description: 'Limites altos + SLA', icon: <Crown size={14} /> },
];

const FILTER_OPTIONS: SelectOption<TenantFilter>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Ativas' },
  { value: 'inactive', label: 'Inativas' },
  { value: 'overdue', label: 'Inadimplentes' },
  { value: 'no-billing', label: 'Sem assinatura' },
  { value: 'deleted', label: 'Excluídas' },
];

export const AdminTenants = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<TenantFilter>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const { tenants, loading, total } = useTenants({ filter, search, includeDeleted: includeDeleted || filter === 'deleted' });
  const { stats, loading: statsLoading, refresh: refreshStats } = useTenantsStats();

  const [showCreate, setShowCreate] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<CreatedInfo | null>(null);
  const [editingLimits, setEditingLimits] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [deletionMode, setDeletionMode] = useState<TenantDeletionMode>('soft');
  const [mobileActionsFor, setMobileActionsFor] = useState<Tenant | null>(null);
  const [busy, setBusy] = useState<{ slug: string; action: string } | null>(null);

  const toggleActive = async (t: Tenant) => {
    setBusy({ slug: t.slug, action: 'toggle' });
    try { await adminApi.setTenantActive(t.slug, !(t.active !== false)); }
    catch (e: any) { alert(`Falha: ${e?.message || e}`); }
    finally { setBusy(null); }
  };

  const refreshUsage = async (t: Tenant) => {
    setBusy({ slug: t.slug, action: 'usage' });
    try { await adminApi.getTenantUsage(t.slug); }
    catch (e: any) { alert(`Falha: ${e?.message || e}`); }
    finally { setBusy(null); }
  };

  const requestDelete = (tenant: Tenant) => {
    setDeletionMode('soft');
    setDeletingTenant(tenant);
  };

  return (
    <div className="space-y-6">
      <Header
        total={total}
        visible={tenants.length}
        onNewTenant={() => setShowCreate(true)}
      />

      <MetricsCards stats={stats} loading={statsLoading} onRefresh={refreshStats} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
        includeDeleted={includeDeleted}
        onToggleDeleted={() => setIncludeDeleted(v => !v)}
      />

      <div className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
        <div className="min-w-0">
          <TenantsList
            tenants={tenants}
            loading={loading}
            busy={busy}
            onToggleActive={toggleActive}
            onEditLimits={setEditingLimits}
            onDelete={requestDelete}
            onRefreshUsage={refreshUsage}
            onOpenMobileActions={setMobileActionsFor}
          />
        </div>

        <aside className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:block 2xl:space-y-4">
          <RankingPanel
            title="Top por uso de tags"
            icon={<TagIcon size={14} />}
            items={stats?.topByTags || []}
            loading={statsLoading}
            unit="tags"
          />
          <RankingPanel
            title="Mais ativas"
            icon={<Activity size={14} />}
            items={(stats?.mostActive || []).map(t => ({ slug: t.slug, name: t.name, plan: t.plan, value: t.lastActivityAt }))}
            loading={statsLoading}
            renderValue={(v) => v ? new Date(v).toLocaleDateString('pt-BR') : '—'}
          />
        </aside>
      </div>

      {/* FAB mobile — só em smartphones */}
      <button
        onClick={() => setShowCreate(true)}
        aria-label="Nova empresa"
        className="md:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 text-zinc-950 flex items-center justify-center shadow-2xl shadow-amber-500/30 active:scale-95 transition-transform"
      >
        <Plus size={22} strokeWidth={3} />
      </button>

      {/* Modais */}
      {showCreate && (
        <CreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={(info) => { setShowCreate(false); setCreatedInfo(info); }}
        />
      )}

      {createdInfo && (
        <CredentialsModal info={createdInfo} onClose={() => setCreatedInfo(null)} />
      )}

      {editingLimits && (
        <EditLimitsModal
          tenant={editingLimits}
          onClose={() => setEditingLimits(null)}
        />
      )}

      <ConfirmStrongModal
        open={!!deletingTenant}
        onClose={() => setDeletingTenant(null)}
        onConfirm={async () => {
          if (!deletingTenant) return;
          await adminApi.deleteTenant(deletingTenant.slug, deletionMode, deletingTenant.name);
        }}
        title="Excluir empresa"
        warningHighlight={deletingTenant ? `Slug: ${deletingTenant.slug}` : undefined}
        description={deletingTenant && (
          <>
            Você está prestes a excluir <strong className="text-white">{deletingTenant.name}</strong>.
            Escolha o tipo de exclusão abaixo. Em ambos os casos, todos os usuários da empresa perderão acesso imediato.
          </>
        )}
        extra={<DeletionModeChooser mode={deletionMode} onChange={setDeletionMode} />}
        confirmText={deletingTenant?.name || ''}
        confirmLabel="Excluir agora"
      />

      {/* Bottom sheet mobile com ações */}
      <BottomSheet
        open={!!mobileActionsFor}
        onClose={() => setMobileActionsFor(null)}
        title={mobileActionsFor?.name || 'Ações'}
      >
        {mobileActionsFor && (
          <MobileActionsSheet
            tenant={mobileActionsFor}
            onClose={() => setMobileActionsFor(null)}
            onEditLimits={(t) => { setMobileActionsFor(null); setEditingLimits(t); }}
            onDelete={(t) => { setMobileActionsFor(null); requestDelete(t); }}
            onToggleActive={toggleActive}
            onRefreshUsage={refreshUsage}
          />
        )}
      </BottomSheet>
    </div>
  );
};

// ============================================================
// HEADER
// ============================================================

const Header = ({ total, visible, onNewTenant }: { total: number; visible: number; onNewTenant: () => void }) => (
  <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
    <div>
      <h1 className="font-display text-2xl font-black uppercase tracking-widest">Empresas</h1>
      <p className="text-zinc-500 text-sm mt-1">
        {visible === total
          ? `${total} ${total === 1 ? 'empresa cadastrada' : 'empresas cadastradas'}`
          : `${visible} de ${total} visíveis`}
      </p>
    </div>
    <button
      onClick={onNewTenant}
      className="hidden md:inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-xl transition-colors"
    >
      <Plus size={14} /> Nova empresa
    </button>
  </header>
);

// ============================================================
// METRICS CARDS
// ============================================================

const MetricsCards = ({
  stats, loading, onRefresh,
}: { stats: ReturnType<typeof useTenantsStats>['stats']; loading: boolean; onRefresh: () => void }) => {
  const top = stats?.topByTags?.[0];
  const overdueCount = stats?.overdue?.length ?? 0;
  const activeCount = stats?.totals?.active ?? 0;

  // Crescimento — último mês vs penúltimo.
  const growthLast = stats?.growth?.slice(-1)[0]?.count ?? 0;
  const growthPrev = stats?.growth?.slice(-2, -1)[0]?.count ?? 0;
  const growthPct = growthPrev === 0 ? (growthLast > 0 ? 100 : 0) : Math.round(((growthLast - growthPrev) / growthPrev) * 100);

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <MetricCard
        label="Empresas ativas"
        value={loading ? null : activeCount}
        icon={<Building2 size={16} />}
        tone="amber"
      />
      <MetricCard
        label="Top por tags"
        value={loading ? null : (top?.value ?? 0)}
        sub={top?.name}
        icon={<TagIcon size={16} />}
        tone="emerald"
      />
      <MetricCard
        label="Inadimplentes"
        value={loading ? null : overdueCount}
        icon={<AlertTriangle size={16} />}
        tone="red"
        link="/admin/billing"
      />
      <MetricCard
        label="Crescimento mês"
        value={loading ? null : `${growthPct >= 0 ? '+' : ''}${growthPct}%`}
        sub={`${growthLast} ${growthLast === 1 ? 'nova' : 'novas'} este mês`}
        icon={<TrendingUp size={16} />}
        tone="blue"
        rightAction={
          <button
            onClick={onRefresh}
            className="text-zinc-500 hover:text-amber-400 p-1 rounded-md transition-colors"
            title="Recalcular"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />
    </section>
  );
};

const MetricCard = ({
  label, value, sub, icon, tone, link, rightAction,
}: {
  label: string;
  value: number | string | null;
  sub?: string;
  icon: React.ReactNode;
  tone: 'amber' | 'emerald' | 'red' | 'blue';
  link?: string;
  rightAction?: React.ReactNode;
}) => {
  const toneCls = {
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  }[tone];
  const gradient = {
    amber: 'from-amber-500/10',
    emerald: 'from-emerald-500/10',
    red: 'from-red-500/10',
    blue: 'from-blue-500/10',
  }[tone];

  const Body = (
    <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-2xl p-4 overflow-hidden transition-colors h-full">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} to-transparent pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate">{label}</span>
          <div className="flex items-center gap-1">
            {rightAction}
            <span className={toneCls}>{icon}</span>
          </div>
        </div>
        <div className={`font-display text-2xl font-black ${toneCls}`}>
          {value === null ? <Skeleton w={60} h={28} rounded="lg" /> : value}
        </div>
        {sub && <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 truncate">{sub}</div>}
      </div>
    </div>
  );

  return link ? <Link to={link} className="block">{Body}</Link> : Body;
};

// ============================================================
// TOOLBAR
// ============================================================

const Toolbar = ({
  search, onSearch, filter, onFilter, includeDeleted, onToggleDeleted,
}: {
  search: string;
  onSearch: (v: string) => void;
  filter: TenantFilter;
  onFilter: (v: TenantFilter) => void;
  includeDeleted: boolean;
  onToggleDeleted: () => void;
}) => (
  <div className="flex flex-col md:flex-row gap-3">
    <div className="flex-1 relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Buscar por nome, slug ou email do pagador…"
        className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder:text-zinc-600 outline-none transition-colors"
      />
    </div>
    <div className="flex items-center gap-2">
      <div className="w-48">
        <Select<TenantFilter> value={filter} onChange={onFilter} options={FILTER_OPTIONS} />
      </div>
      <button
        onClick={onToggleDeleted}
        title="Mostrar excluídas (soft delete)"
        className={`shrink-0 px-3 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-widest transition-colors ${
          includeDeleted
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            : 'border-white/5 hover:border-white/10 text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <Eye size={14} />
      </button>
    </div>
  </div>
);

// ============================================================
// LIST — desktop table + mobile cards
// ============================================================

interface ListActions {
  onToggleActive: (t: Tenant) => void;
  onEditLimits: (t: Tenant) => void;
  onDelete: (t: Tenant) => void;
  onRefreshUsage: (t: Tenant) => void;
  onOpenMobileActions: (t: Tenant) => void;
}

const TenantsList = ({
  tenants, loading, busy, ...actions
}: {
  tenants: Tenant[];
  loading: boolean;
  busy: { slug: string; action: string } | null;
} & ListActions) => {
  if (loading) {
    return (
      <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5">
        <SkeletonRows rows={5} cols={6} />
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-10 text-center">
        <Building2 className="mx-auto mb-3 text-zinc-700" size={32} />
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Nenhuma empresa no filtro atual</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop: só usa tabela quando a largura restante após a sidebar comporta todas as colunas. */}
      <div className="hidden xl:block max-w-full overflow-x-auto bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
            <tr>
              <th className="text-left px-5 py-3.5">Empresa</th>
              <th className="text-left px-5 py-3.5">Plano</th>
              <th className="text-left px-5 py-3.5">Uso de tags</th>
              <th className="text-left px-5 py-3.5">Cobrança</th>
              <th className="text-left px-5 py-3.5">Status</th>
              <th className="text-right px-5 py-3.5">Ações</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {tenants.map((t) => (
                <motion.tr
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 text-xs">
                        {t.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate">{t.name}</div>
                        <code className="text-amber-500 text-[11px]">{t.slug}</code>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><PlanBadge plan={t.plan} /></td>
                  <td className="px-5 py-3.5">
                    <UsageCell tenant={t} loading={busy?.slug === t.slug && busy.action === 'usage'} />
                  </td>
                  <td className="px-5 py-3.5">
                    <BillingStatusBadge status={t.billing?.status || 'none'} />
                  </td>
                  <td className="px-5 py-3.5">
                    {t.deletedAt
                      ? <Badge tone="red" variant="outline">Excluída</Badge>
                      : <Badge tone={t.active !== false ? 'emerald' : 'zinc'}>{t.active !== false ? 'Ativo' : 'Inativo'}</Badge>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <RowActions tenant={t} busy={busy} {...actions} />
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Celular, tablet e notebooks compactos: cards mantêm todas as ações acessíveis. */}
      <div className="xl:hidden space-y-3">
        <AnimatePresence initial={false}>
          {tenants.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-4"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 text-sm shrink-0">
                  {t.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{t.name}</div>
                  <code className="text-amber-500 text-[11px]">{t.slug}</code>
                </div>
                <button
                  onClick={() => actions.onOpenMobileActions(t)}
                  className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
                  aria-label="Ações"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <PlanBadge plan={t.plan} />
                <BillingStatusBadge status={t.billing?.status || 'none'} />
                {t.deletedAt
                  ? <Badge tone="red" variant="outline">Excluída</Badge>
                  : t.active === false
                    ? <Badge tone="zinc">Inativo</Badge>
                    : <Badge tone="emerald">Ativo</Badge>}
              </div>
              <UsageCell tenant={t} loading={busy?.slug === t.slug && busy.action === 'usage'} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

// ============================================================
// USAGE CELL
// ============================================================

const UsageCell = ({ tenant, loading }: { tenant: Tenant; loading: boolean }) => {
  const used = tenant.usage?.tagsUtilizadas ?? 0;
  const limit = tenant.settings?.limiteTags ?? 0;

  if (loading) return <Skeleton w={140} h={20} rounded="lg" />;

  if (!limit) {
    return (
      <div className="space-y-1">
        <div className="text-[11px] font-mono text-zinc-400">{used.toLocaleString('pt-BR')} <span className="text-zinc-600">tags</span></div>
        <div className="text-[9px] uppercase tracking-widest text-zinc-600">Sem limite definido</div>
      </div>
    );
  }

  return <ProgressBar value={used} max={limit} unit="tags" />;
};

// ============================================================
// ROW ACTIONS
// ============================================================

const RowActions = ({
  tenant, busy, onToggleActive, onEditLimits, onDelete, onRefreshUsage,
}: { tenant: Tenant; busy: { slug: string; action: string } | null } & ListActions) => {
  const items: DropdownItem[] = [
    {
      key: 'open',
      label: 'Abrir empresa em nova aba',
      icon: <ExternalLink size={14} />,
      onSelect: () => window.open(openTenantHref(tenant.slug), '_blank'),
    },
    {
      key: 'billing',
      label: 'Gerenciar mensalidade',
      icon: <CreditCard size={14} />,
      onSelect: () => window.location.hash = '#/admin/billing',
    },
    {
      key: 'limits',
      label: 'Editar limites',
      icon: <Settings2 size={14} />,
      onSelect: () => onEditLimits(tenant),
    },
    {
      key: 'usage',
      label: busy?.slug === tenant.slug && busy.action === 'usage' ? 'Recalculando…' : 'Recalcular uso',
      icon: <RefreshCw size={14} />,
      onSelect: () => onRefreshUsage(tenant),
      loading: busy?.slug === tenant.slug && busy.action === 'usage',
    },
    {
      key: 'toggle',
      label: tenant.active !== false ? 'Desativar' : 'Ativar',
      icon: <Power size={14} />,
      onSelect: () => onToggleActive(tenant),
      loading: busy?.slug === tenant.slug && busy.action === 'toggle',
    },
    {
      key: 'delete',
      label: 'Excluir empresa…',
      icon: <Trash2 size={14} />,
      onSelect: () => onDelete(tenant),
      destructive: true,
    },
  ];

  return (
    <DropdownMenu
      items={items}
      trigger={
        <button
          type="button"
          className="text-zinc-500 hover:text-amber-400 hover:bg-white/5 p-2 rounded-lg transition-colors"
          aria-label="Ações"
        >
          <MoreVertical size={15} />
        </button>
      }
    />
  );
};

// ============================================================
// MOBILE ACTIONS SHEET
// ============================================================

const MobileActionsSheet = ({
  tenant, onClose, onEditLimits, onDelete, onToggleActive, onRefreshUsage,
}: {
  tenant: Tenant;
  onClose: () => void;
  onEditLimits: (t: Tenant) => void;
  onDelete: (t: Tenant) => void;
  onToggleActive: (t: Tenant) => void;
  onRefreshUsage: (t: Tenant) => void;
}) => {
  const Row = ({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left text-sm transition-colors ${
        destructive ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-200 hover:bg-white/[0.04]'
      }`}
    >
      <span className="text-zinc-500">{icon}</span>
      {label}
    </button>
  );
  return (
    <div className="divide-y divide-white/5">
      <Row icon={<ExternalLink size={16} />} label="Abrir empresa" onClick={() => window.open(openTenantHref(tenant.slug), '_blank')} />
      <Row icon={<CreditCard size={16} />} label="Gerenciar mensalidade" onClick={() => window.location.hash = '#/admin/billing'} />
      <Row icon={<Settings2 size={16} />} label="Editar limites" onClick={() => onEditLimits(tenant)} />
      <Row icon={<RefreshCw size={16} />} label="Recalcular uso" onClick={() => { onRefreshUsage(tenant); onClose(); }} />
      <Row icon={<Power size={16} />} label={tenant.active !== false ? 'Desativar' : 'Ativar'} onClick={() => { onToggleActive(tenant); onClose(); }} />
      <Row icon={<Trash2 size={16} />} label="Excluir empresa" destructive onClick={() => onDelete(tenant)} />
    </div>
  );
};

// ============================================================
// RANKING PANEL
// ============================================================

const RankingPanel = ({
  title, icon, items, loading, unit, renderValue,
}: {
  title: string;
  icon: React.ReactNode;
  items: { slug: string; name: string; plan: string; value: number; limit?: number }[];
  loading: boolean;
  unit?: string;
  renderValue?: (v: number) => React.ReactNode;
}) => (
  <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-amber-500">{icon}</span>
      <h3 className="font-display text-[11px] font-black uppercase tracking-widest text-zinc-300">{title}</h3>
    </div>
    {loading ? (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={32} rounded="lg" />)}
      </div>
    ) : items.length === 0 ? (
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 py-6 text-center">Sem dados ainda</div>
    ) : (
      <ul className="space-y-1.5">
        {items.slice(0, 7).map((it, i) => (
          <li key={it.slug} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
            <span className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center text-[10px] font-black ${
              i === 0 ? 'bg-amber-500/20 text-amber-400' :
                i === 1 ? 'bg-zinc-700/40 text-zinc-300' :
                  i === 2 ? 'bg-orange-700/30 text-orange-300' :
                    'bg-white/[0.03] text-zinc-500'
            }`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{it.name}</div>
              <code className="text-[10px] text-amber-500/80">{it.slug}</code>
            </div>
            <div className="text-right shrink-0">
              {it.limit
                ? <UsageBadge value={it.value} max={it.limit} />
                : <span className="text-[11px] font-mono text-zinc-300">
                  {renderValue ? renderValue(it.value) : `${it.value.toLocaleString('pt-BR')}${unit ? ` ${unit}` : ''}`}
                </span>}
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

// ============================================================
// EDIT LIMITS MODAL
// ============================================================

const EditLimitsModal = ({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) => {
  const [limiteTags, setLimiteTags] = useState<number>(tenant.settings?.limiteTags ?? 0);
  const [limiteVeiculos, setLimiteVeiculos] = useState<number>(tenant.settings?.limiteVeiculos ?? 0);
  const [maxUsers, setMaxUsers] = useState<number>(tenant.settings?.maxUsers ?? 0);
  const [features, setFeatures] = useState<string[]>(tenant.settings?.features ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    setSubmitting(true);
    try {
      await adminApi.updateTenantLimits(tenant.slug, { limiteTags, limiteVeiculos, maxUsers, features });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const tagsUsed = tenant.usage?.tagsUtilizadas ?? 0;
  const tagsWarning = limiteTags > 0 && tagsUsed > limiteTags;

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="edit-tenant-limits-title">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="modal-card border-zinc-200 !bg-white text-zinc-900 dark:!border-white/10 dark:!bg-zinc-950 dark:text-white sm:!max-w-2xl"
      >
        <div className="modal-card-header flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-white/10 sm:px-6 sm:py-5">
          <div>
            <h3 id="edit-tenant-limits-title" className="font-display font-black text-base uppercase tracking-widest sm:text-lg">Editar limites</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tenant.name} <span className="px-1 text-zinc-300 dark:text-zinc-700">·</span> <code className="text-amber-600 dark:text-amber-500">{tenant.slug}</code></p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl border border-transparent p-2 text-zinc-500 transition-colors hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-card-body space-y-6 px-5 py-5 sm:px-6">
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">{error}</div>
          )}

          <section>
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Limites de uso</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <LimitField label="Tags" value={limiteTags} onChange={setLimiteTags} hint="0 = ilimitado" warning={tagsWarning ? `Uso atual: ${tagsUsed}` : undefined} currentUsed={tagsUsed} />
              <LimitField label="Veículos" value={limiteVeiculos} onChange={setLimiteVeiculos} hint="0 = ilimitado" currentUsed={tenant.usage?.veiculosUtilizados} />
              <LimitField label="Usuários" value={maxUsers} onChange={setMaxUsers} hint="0 = ilimitado" currentUsed={tenant.usage?.usuariosAtivos} />
            </div>
          </section>

          <section className="border-t border-zinc-200 pt-5 dark:border-white/10">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Módulos autorizados para a empresa</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MODULE_CATALOG.filter(module => BUSINESS_MODULE_IDS.includes(module.id as (typeof BUSINESS_MODULE_IDS)[number])).map(module => (
              <label key={module.id} className={`flex min-h-24 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${features.includes(module.id) ? 'border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-white/10 dark:bg-white/[0.025] dark:hover:border-white/20'}`}>
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500" checked={features.includes(module.id)} onChange={() => setFeatures(current => current.includes(module.id) ? current.filter(id => id !== module.id) : [...current, module.id])} />
                <span><span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">{module.label}</span><span className="block text-[10px] text-zinc-500 dark:text-zinc-400">{module.description}</span></span>
              </label>
            ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-amber-700 dark:text-amber-500/80">O administrador da empresa só poderá distribuir aos cargos os módulos marcados aqui.</p>
          </section>
        </div>

        <div className="modal-card-footer flex gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-white/10 dark:bg-black/20 sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-5 text-xs font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-zinc-400 dark:hover:bg-white/[0.04] dark:hover:text-white sm:flex-none sm:min-w-32"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={submitting}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500 px-5 text-xs font-black uppercase tracking-widest text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50 sm:flex-none sm:min-w-32"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const LimitField = ({
  label, value, onChange, hint, warning, currentUsed,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  warning?: string;
  currentUsed?: number;
}) => (
  <div className="min-w-0">
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{label}</label>
    <div className="flex min-w-0 items-center gap-2">
      <input
        type="number"
        min="0"
        value={value || ''}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        placeholder="0 (ilimitado)"
        className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm font-mono text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-zinc-600 dark:hover:border-white/20 dark:focus:border-amber-500/50 dark:focus:bg-white/[0.05]"
      />
      {currentUsed !== undefined && value > 0 && (
        <UsageBadge value={currentUsed} max={value} />
      )}
    </div>
    {hint && <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-600">{hint}</div>}
    {warning && <div className="text-[10px] text-red-400 mt-1">{warning}</div>}
  </div>
);

// ============================================================
// DELETION MODE CHOOSER (passado ao ConfirmStrongModal via extra)
// ============================================================

const DeletionModeChooser = ({
  mode,
  onChange,
}: {
  mode: TenantDeletionMode;
  onChange: (mode: TenantDeletionMode) => void;
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ModeCard
        active={mode === 'soft'}
        onClick={() => onChange('soft')}
        title="Soft delete"
        tone="amber"
        bullets={['Desativa acesso', 'Dados preservados', 'Reversível']}
      />
      <ModeCard
        active={mode === 'hard'}
        onClick={() => onChange('hard')}
        title="Hard delete"
        tone="red"
        bullets={['Apaga tudo recursivamente', 'Cancela cobrança Asaas', 'Irreversível']}
      />
    </div>
  );
};

const ModeCard = ({
  active, onClick, title, tone, bullets,
}: { active: boolean; onClick: () => void; title: string; tone: 'amber' | 'red'; bullets: string[] }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left p-3 rounded-xl border transition-all ${
      active
        ? tone === 'red'
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-amber-500/40 bg-amber-500/5'
        : 'border-white/5 hover:border-white/10 bg-white/[0.02]'
    }`}
  >
    <div className={`text-[11px] font-black uppercase tracking-widest mb-1 ${
      active ? (tone === 'red' ? 'text-red-400' : 'text-amber-400') : 'text-zinc-400'
    }`}>{title}</div>
    <ul className="space-y-0.5">
      {bullets.map((b, i) => (
        <li key={i} className="text-[10px] text-zinc-500 flex items-center gap-1">
          <span className={`w-1 h-1 rounded-full ${tone === 'red' ? 'bg-red-500/50' : 'bg-amber-500/50'}`} />
          {b}
        </li>
      ))}
    </ul>
  </button>
);

// ============================================================
// CREATE TENANT MODAL + CREDENTIALS MODAL
// ============================================================

interface CreatedInfo {
  slug: string;
  ownerEmail: string | null;
  ownerPassword: string | null;
}

const CreateTenantModal = ({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (info: CreatedInfo) => void;
}) => {
  const [form, setForm] = useState({
    slug: '',
    name: '',
    plan: 'basic' as 'basic' | 'pro' | 'enterprise',
    ownerEmail: '',
    ownerName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await adminApi.createTenant({
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        plan: form.plan,
        active: true,
        ownerEmail: form.ownerEmail.trim() || undefined,
        ownerName: form.ownerName.trim() || undefined,
      });
      onCreated(data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao criar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-shell">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl shadow-black/60"
      >
        <div className="flex items-start justify-between">
          <h3 className="font-display font-black text-lg uppercase tracking-widest">Nova empresa</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
        {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">{error}</div>}
        <FieldInput label="Slug (subdomínio)" value={form.slug} onChange={(v: string) => setForm({ ...form, slug: v })} required placeholder="empresa-acme" />
        <FieldInput label="Nome" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} required placeholder="Empresa Acme" />
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Plano</label>
          <Select<'basic' | 'pro' | 'enterprise'>
            value={form.plan}
            onChange={(v) => setForm({ ...form, plan: v })}
            options={PLAN_OPTIONS}
          />
        </div>
        <div className="border-t border-white/5 pt-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Admin inicial (opcional)</p>
          <FieldInput label="Email do admin" value={form.ownerEmail} onChange={(v: string) => setForm({ ...form, ownerEmail: v })} type="email" placeholder="admin@empresa.com" />
          <FieldInput label="Nome do admin" value={form.ownerName} onChange={(v: string) => setForm({ ...form, ownerName: v })} placeholder="João da Silva" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white py-2.5 rounded-xl border border-white/5 hover:bg-white/[0.04]">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 rounded-xl">
            {submitting ? <Loader2 className="inline animate-spin" size={14} /> : 'Criar'}
          </button>
        </div>
      </motion.form>
    </div>
  );
};

const FieldInput = ({ label, value, onChange, type = 'text', required, placeholder }: any) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
      className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-xl px-3 py-2.5 text-sm placeholder:text-zinc-600 outline-none transition-colors"
    />
  </div>
);

const CredentialsModal = ({ info, onClose }: { info: CreatedInfo; onClose: () => void }) => (
  <div className="modal-shell">
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="bg-zinc-950 border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl shadow-black/60"
    >
      <h3 className="font-display font-black text-lg uppercase tracking-widest">Empresa criada</h3>
      <p className="text-sm text-zinc-400">Slug: <code className="text-amber-500">{info.slug}</code></p>
      {info.ownerEmail && info.ownerPassword && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Credenciais iniciais do admin</p>
          <CredentialRow label="Email" value={info.ownerEmail} />
          <CredentialRow label="Senha" value={info.ownerPassword} />
          <p className="text-[10px] text-zinc-400">Envie ao admin e oriente a trocar a senha no primeiro login. Esta senha não será exibida novamente.</p>
        </div>
      )}
      <button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 rounded-xl">
        Fechar
      </button>
    </motion.div>
  </div>
);

const CredentialRow = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between gap-2 bg-zinc-950 rounded-lg px-3 py-2 border border-white/10">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</div>
        <div className="font-mono text-sm text-white truncate">{value}</div>
      </div>
      <button onClick={copy} className="text-zinc-500 hover:text-amber-500 p-1.5 transition-colors" aria-label="Copiar">
        {copied ? <span className="text-[10px] font-bold text-emerald-400">OK</span> : <Copy size={14} />}
      </button>
    </div>
  );
};

const PlanBadge = ({ plan }: { plan?: string }) => {
  const tone = plan === 'enterprise' ? 'purple' : plan === 'pro' ? 'blue' : 'neutral';
  return <Badge tone={tone as any}>{plan || 'basic'}</Badge>;
};

function openTenantHref(slug: string): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${window.location.protocol}//${encodeURIComponent(slug)}.localhost${port}/`;
  }
  const parts = host.split('.');
  if (parts.length >= 3) {
    parts[0] = slug;
    return `${window.location.protocol}//${parts.join('.')}`;
  }
  return '#';
}

// Re-export para retrocompatibilidade — UsageBadge é usado também em outros pontos.
export { UsageBadge };
