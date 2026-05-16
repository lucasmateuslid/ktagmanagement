import * as React from 'react';
import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import type { Tenant, Invoice, BillingCycle, BillingMethod } from '../../types';
import {
  X, Loader2, RefreshCw, CreditCard, Trash2, ExternalLink, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { BillingStatusBadge } from './AdminBilling';

const fmtBRL = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('pt-BR') : '—';

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'YEARLY', label: 'Anual' },
];

const METHODS: { value: BillingMethod; label: string }[] = [
  { value: 'UNDEFINED', label: 'Cliente escolhe' },
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão' },
];

type Props = {
  tenant: Tenant;
  onClose: () => void;
};

export const TenantBillingDetail = ({ tenant, onClose }: Props) => {
  const billing = tenant.billing;
  const hasSubscription = !!billing?.asaasSubscriptionId;
  const [form, setForm] = useState({
    priceCents: billing?.priceCents ?? planDefaultPrice(tenant.plan),
    cycle: (billing?.cycle ?? 'MONTHLY') as BillingCycle,
    billingType: (billing?.method ?? 'UNDEFINED') as BillingMethod,
    dueDay: billing?.dueDay ?? 10,
    payerName: billing?.payerName ?? '',
    payerEmail: billing?.payerEmail ?? '',
    payerCpfCnpj: billing?.payerCpfCnpj ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    if (!hasSubscription) return;
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  const loadInvoices = async () => {
    if (!functions) return;
    setLoadingInvoices(true);
    try {
      const fn = httpsCallable<any, { invoices: Invoice[] }>(functions, 'listTenantInvoices');
      const res = await fn({ slug: tenant.slug });
      setInvoices(res.data.invoices || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const submit = async () => {
    if (!functions) return;
    setError(''); setInfo(''); setSubmitting(true);
    try {
      const fnName = hasSubscription ? 'updateTenantSubscription' : 'createTenantSubscription';
      const payload: any = {
        slug: tenant.slug,
        priceCents: form.priceCents,
        cycle: form.cycle,
        billingType: form.billingType,
        dueDay: form.dueDay,
      };
      if (!hasSubscription) {
        payload.payer = {
          name: form.payerName,
          email: form.payerEmail,
          cpfCnpj: form.payerCpfCnpj,
        };
      }
      const fn = httpsCallable(functions, fnName);
      await fn(payload);
      setInfo(hasSubscription ? 'Assinatura atualizada.' : 'Assinatura criada com sucesso.');
    } catch (e: any) {
      setError(e?.message || 'Falha.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!functions) return;
    if (!confirm(`Cancelar assinatura de "${tenant.name}"? Faturas pendentes serão removidas no Asaas.`)) return;
    setError(''); setInfo(''); setSubmitting(true);
    try {
      const fn = httpsCallable(functions, 'cancelTenantSubscription');
      await fn({ slug: tenant.slug });
      setInfo('Assinatura cancelada.');
    } catch (e: any) {
      setError(e?.message || 'Falha.');
    } finally {
      setSubmitting(false);
    }
  };

  const sync = async () => {
    if (!functions) return;
    setError(''); setSubmitting(true);
    try {
      const fn = httpsCallable(functions, 'syncTenantBilling');
      await fn({ slug: tenant.slug });
      await loadInvoices();
      setInfo('Sincronizado com o Asaas.');
    } catch (e: any) {
      setError(e?.message || 'Falha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-3xl my-8 shadow-2xl shadow-black/50 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 w-72 h-72 rounded-full bg-amber-500/10 blur-[100px]" />
        <header className="relative flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 text-lg">
              {tenant.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-display font-black text-xl uppercase tracking-widest">{tenant.name}</h3>
                <BillingStatusBadge status={billing?.status || 'none'} />
              </div>
              <code className="text-amber-500 text-xs">{tenant.slug}</code>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </header>

        <div className="relative p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <section>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Plano + cobrança</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (R$)" hint="Ex: 99.90">
                <input
                  type="number" step="0.01" min="1"
                  value={(form.priceCents / 100).toFixed(2)}
                  onChange={(e) => setForm({ ...form, priceCents: Math.round(Number(e.target.value) * 100) })}
                  className={inputCls}
                />
              </Field>
              <Field label="Ciclo">
                <select value={form.cycle} onChange={e => setForm({ ...form, cycle: e.target.value as BillingCycle })} className={inputCls}>
                  {CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Método">
                <select value={form.billingType} onChange={e => setForm({ ...form, billingType: e.target.value as BillingMethod })} className={inputCls}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Dia do vencimento" hint="1 a 28">
                <input
                  type="number" min="1" max="28"
                  value={form.dueDay}
                  onChange={e => setForm({ ...form, dueDay: Math.min(28, Math.max(1, Number(e.target.value))) })}
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          {!hasSubscription && (
            <section>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Dados do pagador</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome / Razão social">
                  <input value={form.payerName} onChange={e => setForm({ ...form, payerName: e.target.value })} className={inputCls} required />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.payerEmail} onChange={e => setForm({ ...form, payerEmail: e.target.value })} className={inputCls} required />
                </Field>
                <Field label="CPF / CNPJ" hint="Somente números">
                  <input value={form.payerCpfCnpj} onChange={e => setForm({ ...form, payerCpfCnpj: e.target.value.replace(/\D/g, '') })} className={inputCls} required />
                </Field>
              </div>
            </section>
          )}

          {hasSubscription && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Faturas recentes</h4>
                <button onClick={sync} disabled={submitting} className="text-[10px] font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400 inline-flex items-center gap-1.5">
                  <RefreshCw size={11} className={submitting ? 'animate-spin' : ''} />
                  Sincronizar
                </button>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                {loadingInvoices ? (
                  <div className="p-6 text-center text-zinc-500"><Loader2 className="inline animate-spin" size={14} /></div>
                ) : invoices.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-xs uppercase tracking-widest">Nenhuma fatura ainda</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
                      <tr>
                        <th className="text-left px-4 py-2.5">Vencimento</th>
                        <th className="text-left px-4 py-2.5">Valor</th>
                        <th className="text-left px-4 py-2.5">Status</th>
                        <th className="text-right px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id} className="border-t border-white/5">
                          <td className="px-4 py-2.5 text-zinc-300">{fmtDate(inv.dueDate)}</td>
                          <td className="px-4 py-2.5 font-mono">{fmtBRL(inv.valueCents)}</td>
                          <td className="px-4 py-2.5"><InvoiceStatusBadge status={inv.status} /></td>
                          <td className="px-4 py-2.5 text-right">
                            {inv.invoiceUrl && (
                              <a href={inv.invoiceUrl} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400">
                                Asaas <ExternalLink size={11} />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="relative flex items-center justify-between gap-3 p-6 border-t border-white/5 bg-zinc-950/40">
          <div className="text-[10px] text-zinc-600">
            {billing?.lastSyncedAt && <>Última sincronização: {new Date(billing.lastSyncedAt).toLocaleString('pt-BR')}</>}
          </div>
          <div className="flex items-center gap-2">
            {hasSubscription && (
              <button
                onClick={cancel}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-300 px-3 py-2.5 rounded-xl border border-red-900/40 hover:bg-red-950/30 disabled:opacity-50"
              >
                <Trash2 size={13} /> Cancelar assinatura
              </button>
            )}
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-xl"
            >
              {submitting ? <Loader2 className="animate-spin" size={13} /> : <CreditCard size={13} />}
              {hasSubscription ? 'Atualizar' : 'Criar assinatura'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

const inputCls = "w-full bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-xl px-3 py-2.5 text-sm placeholder:text-zinc-600 focus:border-amber-500/40 focus:bg-white/[0.05] focus:outline-none transition-colors";

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{label}</label>
    {children}
    {hint && <div className="text-[10px] text-zinc-600 mt-1">{hint}</div>}
  </div>
);

const InvoiceStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    RECEIVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    CONFIRMED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    OVERDUE: 'bg-red-500/10 text-red-400 border-red-500/20',
    REFUNDED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    CANCELED: 'bg-zinc-700/40 text-zinc-300 border-zinc-700',
  };
  const labels: Record<string, string> = {
    PENDING: 'Pendente', RECEIVED: 'Recebida', CONFIRMED: 'Confirmada',
    OVERDUE: 'Vencida', REFUNDED: 'Reembolsada', CANCELED: 'Cancelada',
  };
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status] || map.PENDING}`}>
      {labels[status] || status}
    </span>
  );
};

function planDefaultPrice(plan?: string): number {
  switch (plan) {
    case 'enterprise': return 99900;
    case 'pro': return 29900;
    default: return 9900;
  }
}
