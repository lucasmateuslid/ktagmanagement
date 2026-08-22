import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../../services/firebase';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Receipt, RefreshCw, Loader2, ExternalLink, Filter, Calendar, TrendingUp, CheckCircle2, AlertTriangle, RotateCw, Download, Search, Building2, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Invoice, Tenant } from '../../types';
import { Select } from '../../components/ui/select';
import { SkeletonRows } from '../../components/ui/skeleton';
import { adminApi } from '../../services/adminApi';

interface InvoiceRow extends Invoice {
  tenantName?: string;
}

interface HistoryPoint {
  month: string;
  revenueCents: number;
  invoicesCount: number;
  paidTenants: number;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'RECEIVED', label: 'Recebidas' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'OVERDUE', label: 'Vencidas' },
  { value: 'REFUNDED', label: 'Reembolsadas' },
  { value: 'CANCELED', label: 'Canceladas' },
];

const fmtBRL = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtBRLShort = (cents: number) => {
  const v = cents / 100;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('pt-BR') : '—';

const monthLabel = (key: string) => {
  const [, m] = key.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return names[Number(m) - 1] || m;
};

export const AdminInvoices = () => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [currentMrrCents, setCurrentMrrCents] = useState(0);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTenant, setFilterTenant] = useState<string>('all');
  const [filterMonths, setFilterMonths] = useState<number>(6);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [showByTenant, setShowByTenant] = useState(false);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'tenants'), (snap) => {
      const list: Tenant[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setTenants(list);
    });
    return () => unsub();
  }, []);

  const loadHistory = async () => {
    if (!functions) return;
    setHistoryLoading(true);
    try {
      const fn = httpsCallable<any, { history: HistoryPoint[]; currentMrrCents: number }>(functions, 'aggregateMRRHistory');
      const res = await fn({ months: 12 });
      setHistory(res.data.history || []);
      setCurrentMrrCents(res.data.currentMrrCents || 0);
    } catch (e) {
      console.error('aggregateMRRHistory failed', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadInvoices = async () => {
    if (!functions) return;
    setRefreshing(true);
    try {
      const fromMs = Date.now() - filterMonths * 31 * 24 * 3600 * 1000;
      const payload: any = { fromMs, limit: 300 };
      if (filterStatus !== 'all') payload.status = filterStatus;
      if (filterTenant !== 'all') payload.tenantSlug = filterTenant;
      const fn = httpsCallable<any, { invoices: InvoiceRow[] }>(functions, 'listInvoicesGlobal');
      const res = await fn(payload);
      setInvoices(res.data.invoices || []);
    } catch (e) {
      console.error('listInvoicesGlobal failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSyncAsaas = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await adminApi.syncAllTenantsBilling();
      setSyncResult({ synced: result.synced, errors: result.errors });
      await loadInvoices();
    } catch (e: any) {
      setSyncResult({ synced: 0, errors: [e?.message || 'Erro ao sincronizar'] });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);
  useEffect(() => { loadInvoices(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterStatus, filterTenant, filterMonths]);

  const stats = useMemo(() => {
    let received = 0, overdue = 0, pending = 0, totalReceivedCents = 0;
    for (const i of invoices) {
      if (i.status === 'RECEIVED' || i.status === 'CONFIRMED') {
        received++;
        totalReceivedCents += i.valueCents || 0;
      } else if (i.status === 'OVERDUE') overdue++;
      else if (i.status === 'PENDING') pending++;
    }
    return { received, overdue, pending, totalReceivedCents };
  }, [invoices]);

  const totalRevenue12m = useMemo(
    () => history.reduce((a, p) => a + p.revenueCents, 0),
    [history]
  );

  const byTenant = useMemo(() => {
    type Row = { name: string; receivedCents: number; pendingCents: number; overdueCents: number; count: number };
    const map: Record<string, Row> = {};
    for (const inv of invoices) {
      if (!map[inv.tenantId]) {
        map[inv.tenantId] = { name: inv.tenantName || inv.tenantId, receivedCents: 0, pendingCents: 0, overdueCents: 0, count: 0 };
      }
      const e = map[inv.tenantId];
      e.count++;
      if (inv.status === 'RECEIVED' || inv.status === 'CONFIRMED') e.receivedCents += inv.valueCents || 0;
      else if (inv.status === 'PENDING') e.pendingCents += inv.valueCents || 0;
      else if (inv.status === 'OVERDUE') e.overdueCents += inv.valueCents || 0;
    }
    return Object.values(map).sort((a, b) => b.receivedCents - a.receivedCents);
  }, [invoices]);

  // Busca textual local sobre as faturas já carregadas (filtros de status/tenant/período rodam no backend)
  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter(inv =>
      inv.tenantName?.toLowerCase().includes(term) ||
      inv.tenantId?.toLowerCase().includes(term) ||
      inv.description?.toLowerCase().includes(term) ||
      inv.id?.toLowerCase().includes(term)
    );
  }, [invoices, search]);

  const exportCsv = () => {
    if (filteredInvoices.length === 0) return;
    const header = ['Empresa', 'Slug', 'Vencimento', 'Pago em', 'Valor (R$)', 'Método', 'Status', 'Descrição', 'ID'];
    const rows = filteredInvoices.map(inv => [
      inv.tenantName || '',
      inv.tenantId || '',
      inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('pt-BR') : '',
      inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('pt-BR') : '',
      ((inv.valueCents || 0) / 100).toFixed(2).replace('.', ','),
      inv.billingType || '',
      inv.status,
      (inv.description || '').replace(/"/g, '""'),
      inv.id,
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${c}"`).join(';'))
      .join('\n');
    // BOM para Excel reconhecer UTF-8.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faturas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest">Faturas</h1>
          <p className="text-zinc-500 text-sm mt-1">Histórico global de cobranças e receita</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncAsaas}
            disabled={syncing}
            title="Puxa todas as faturas (pagas e não pagas) do Asaas para o Firestore"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando…' : 'Sincronizar Asaas'}
          </button>
          <button
            onClick={() => { loadHistory(); loadInvoices(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300 px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
          >
            <RotateCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </header>

      {syncResult && (
        <div className={`text-xs font-bold px-4 py-2.5 rounded-xl border ${syncResult.errors.length > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          {syncResult.errors.length === 0
            ? `${syncResult.synced} empresa${syncResult.synced === 1 ? '' : 's'} sincronizada${syncResult.synced === 1 ? '' : 's'} com sucesso.`
            : `${syncResult.synced} sincronizados · ${syncResult.errors.length} erro${syncResult.errors.length === 1 ? '' : 's'}: ${syncResult.errors.slice(0, 3).join(', ')}${syncResult.errors.length > 3 ? '…' : ''}`
          }
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="MRR atual"
          value={fmtBRL(currentMrrCents)}
          icon={TrendingUp}
          color="text-amber-400"
          tint="from-amber-500/10 to-transparent"
        />
        <StatTile
          label="Receita 12m"
          value={fmtBRL(totalRevenue12m)}
          icon={Receipt}
          color="text-emerald-400"
          tint="from-emerald-500/10 to-transparent"
        />
        <StatTile
          label="Recebidas (filtro)"
          value={`${stats.received}`}
          subtitle={fmtBRL(stats.totalReceivedCents)}
          icon={CheckCircle2}
          color="text-emerald-400"
          tint="from-emerald-500/5 to-transparent"
        />
        <StatTile
          label="Vencidas (filtro)"
          value={`${stats.overdue}`}
          subtitle={`${stats.pending} pendentes`}
          icon={AlertTriangle}
          color="text-red-400"
          tint="from-red-500/10 to-transparent"
        />
      </section>

      <section className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Receita realizada</span>
            <div className="font-display text-3xl font-black mt-1">
              {historyLoading ? '—' : fmtBRL(totalRevenue12m)}
              <span className="text-zinc-600 text-sm font-bold ml-2">últimos 12 meses</span>
            </div>
          </div>
          <TrendingUp className="text-amber-500/60" size={18} />
        </div>
        <div className="h-64 -mx-2">
          {historyLoading ? (
            <div className="h-full flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest">Carregando histórico…</div>
          ) : history.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest">Sem receita registrada ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  tick={{ fill: '#71717a', fontSize: 10, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => fmtBRLShort(v)}
                  tick={{ fill: '#52525b', fontSize: 10, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{
                    background: 'rgba(9, 9, 11, 0.95)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(v: number, n) => n === 'revenueCents' ? [fmtBRL(v), 'Receita'] : [v, n]}
                  labelFormatter={monthLabel}
                />
                <Area
                  type="monotone"
                  dataKey="revenueCents"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#revFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Recebido por cliente */}
      {!loading && byTenant.length > 0 && (
        <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
          <button
            onClick={() => setShowByTenant(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Recebido por cliente</span>
              <span className="text-[10px] text-zinc-600 font-bold">({byTenant.length})</span>
            </div>
            {showByTenant ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
          </button>
          {showByTenant && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
                  <tr>
                    <th className="text-left px-5 py-3">Empresa</th>
                    <th className="text-left px-5 py-3">Recebido</th>
                    <th className="text-left px-5 py-3">Pendente</th>
                    <th className="text-left px-5 py-3">Em atraso</th>
                    <th className="text-left px-5 py-3">Faturas</th>
                  </tr>
                </thead>
                <tbody>
                  {byTenant.map((row, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 font-bold text-xs text-zinc-200">{row.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-emerald-400 font-bold">{fmtBRL(row.receivedCents)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-amber-400">{fmtBRL(row.pendingCents)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-red-400">{fmtBRL(row.overdueCents)}</td>
                      <td className="px-5 py-3 text-xs text-zinc-500">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden">
        <div className="flex flex-col gap-3 p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por empresa, descrição ou ID…"
                className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-xl pl-9 pr-3 py-2 text-sm placeholder:text-zinc-600 outline-none transition-colors"
              />
            </div>
            <button
              onClick={exportCsv}
              disabled={filteredInvoices.length === 0}
              title="Exportar para CSV (Excel)"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-400 hover:text-amber-300 disabled:opacity-40 px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
            >
              <Download size={13} /> CSV
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <Filter size={14} className="text-zinc-500" />
          <FilterSelect
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            label="Empresa"
            value={filterTenant}
            onChange={setFilterTenant}
            options={[{ value: 'all', label: 'Todas' }, ...tenants.map(t => ({ value: t.slug, label: t.name }))]}
          />
          <FilterSelect
            label="Período"
            value={String(filterMonths)}
            onChange={(v) => setFilterMonths(Number(v))}
            options={[
              { value: '3', label: 'Últ. 3 meses' },
              { value: '6', label: 'Últ. 6 meses' },
              { value: '12', label: 'Últ. 12 meses' },
              { value: '24', label: 'Últ. 24 meses' },
            ]}
          />
          <div className="ml-auto text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            {loading ? 'carregando…' : (
              search
                ? `${filteredInvoices.length} de ${invoices.length} fatura${invoices.length === 1 ? '' : 's'}`
                : `${invoices.length} fatura${invoices.length === 1 ? '' : 's'}`
            )}
          </div>
          </div>
        </div>

        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} cols={7} />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <Receipt className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-widest">
              {invoices.length === 0 ? 'Nenhuma fatura no filtro atual' : `Nenhuma fatura corresponde a "${search}"`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
                <tr>
                  <th className="text-left px-5 py-3.5">Empresa</th>
                  <th className="text-left px-5 py-3.5">Vencimento</th>
                  <th className="text-left px-5 py-3.5">Pago em</th>
                  <th className="text-left px-5 py-3.5">Valor</th>
                  <th className="text-left px-5 py-3.5">Método</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                  <th className="text-right px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => (
                  <tr key={`${inv.tenantId}-${inv.id}`} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 text-[11px]">
                          {(inv.tenantName || inv.tenantId)?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-xs">{inv.tenantName || inv.tenantId}</div>
                          <code className="text-amber-500 text-[10px]">{inv.tenantId}</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-zinc-600" />
                        {fmtDate(inv.dueDate)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400 text-xs">
                      {inv.paidAt ? fmtDate(inv.paidAt) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-zinc-200">{fmtBRL(inv.valueCents)}</td>
                    <td className="px-5 py-3.5 text-zinc-400 text-[10px] uppercase tracking-widest">{inv.billingType || '—'}</td>
                    <td className="px-5 py-3.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {inv.invoiceUrl ? (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400"
                        >
                          Asaas <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const StatTile = ({
  label, value, subtitle, icon: Icon, color, tint,
}: { label: string; value: string; subtitle?: string; icon: any; color: string; tint: string }) => (
  <div className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 overflow-hidden">
    <div className={`absolute inset-0 bg-gradient-to-br ${tint} opacity-80 pointer-events-none`} />
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
        <Icon className={color} size={16} />
      </div>
      <div className={`font-display text-2xl font-black ${color}`}>{value}</div>
      {subtitle && <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{subtitle}</div>}
    </div>
  </div>
);

const FilterSelect = ({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
  <div className="inline-flex items-center gap-2 min-w-[180px]">
    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 shrink-0">{label}</span>
    <div className="flex-1">
      <Select<string>
        value={value}
        onChange={onChange}
        options={options}
      />
    </div>
  </div>
);

const InvoiceStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    RECEIVED: { label: 'Recebida', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    CONFIRMED: { label: 'Confirmada', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    OVERDUE: { label: 'Vencida', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    REFUNDED: { label: 'Reembolsada', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    CANCELED: { label: 'Cancelada', cls: 'bg-zinc-800/60 text-zinc-300 border-white/5' },
  };
  const cfg = map[status] || map.PENDING;
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};
