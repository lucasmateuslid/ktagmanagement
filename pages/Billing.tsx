import React, { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
import { useNotification } from '../contexts/NotificationContext';
import type { Invoice, BillingCycle, BillingMethod, BillingStatus, TenantPlan } from '../types';
import {
  Receipt, CreditCard, RefreshCw, ExternalLink, Copy, Check, Loader2,
  Calendar, AlertTriangle, CheckCircle2, CircleSlash, TrendingUp, Plug, QrCode, FileText, Clock,
} from 'lucide-react';

interface MyBillingResp {
  tenant: { id: string; name: string; slug: string; plan: TenantPlan; active: boolean };
  billing: {
    status: BillingStatus;
    priceCents?: number;
    cycle?: BillingCycle;
    method?: BillingMethod;
    dueDay?: number;
    nextDueDate?: number;
    lastSyncedAt?: number;
    payerName?: string;
    payerEmail?: string;
  };
}

const fmtBRL = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('pt-BR') : '—';

const fmtDateTime = (ms?: number) =>
  ms ? new Date(ms).toLocaleString('pt-BR') : '—';

const CYCLE_LABEL: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
};

const METHOD_LABEL: Record<BillingMethod, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão',
  UNDEFINED: 'Cliente escolhe',
};

export const Billing = () => {
  const { addNotification } = useNotification();
  const [data, setData] = useState<MyBillingResp | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const loadAll = async (showSpinner = false) => {
    if (!functions) return;
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const fnBilling = httpsCallable<any, MyBillingResp>(functions, 'getMyTenantBilling');
      const fnInvoices = httpsCallable<any, { invoices: Invoice[] }>(functions, 'listMyTenantInvoices');
      const [b, i] = await Promise.all([fnBilling({}), fnInvoices({})]);
      setData(b.data);
      setInvoices(i.data.invoices || []);
    } catch (e: any) {
      console.error('billing load failed', e);
      setError(e?.message || 'Falha ao carregar dados de cobrança.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(true); }, []);

  const handleSync = async () => {
    if (!functions || syncing) return;
    setSyncing(true);
    setError('');
    try {
      const fn = httpsCallable(functions, 'syncMyTenantBilling');
      await fn({});
      await loadAll();
      addNotification?.('success', 'Sincronizado', 'Status de cobrança atualizado com o Asaas.');
    } catch (e: any) {
      const msg = e?.message || 'Falha ao sincronizar.';
      setError(msg);
      addNotification?.('error', 'Sync falhou', msg);
    } finally {
      setSyncing(false);
    }
  };

  const pending = useMemo(
    () => invoices.find(i => i.status === 'PENDING' || i.status === 'OVERDUE'),
    [invoices]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest text-zinc-900 dark:text-white">
            Mensalidade
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Sua assinatura, faturas e instruções de pagamento
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 px-3 py-2 rounded-xl border border-primary-500/20 bg-primary-500/5 hover:bg-primary-500/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          Sincronizar
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {data && !data.tenant.active && (
        <div className="flex items-start gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl px-4 py-4">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-black uppercase tracking-widest text-[11px]">Acesso suspenso</div>
            <p className="mt-1 text-[13px]">
              A sua empresa está com acesso suspenso por inadimplência. Quite a fatura em aberto para reativar.
            </p>
          </div>
        </div>
      )}

      <SubscriptionCard
        plan={data?.tenant.plan}
        billing={data?.billing}
        pending={pending}
      />

      {pending && (
        <PendingPaymentCard invoice={pending} />
      )}

      <InvoicesList invoices={invoices} onChanged={() => loadAll()} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Subscription summary card
// ─────────────────────────────────────────────────────────────────────────

const SubscriptionCard = ({
  plan, billing, pending,
}: {
  plan?: TenantPlan;
  billing?: MyBillingResp['billing'];
  pending?: Invoice;
}) => {
  const status = billing?.status || 'none';
  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-6 md:p-7">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary-500/10 blur-3xl" />
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Plano atual</span>
            <PlanBadge plan={plan} />
            <BillingStatusBadge status={status} />
          </div>
          <div className="font-display text-3xl font-black text-zinc-900 dark:text-white">
            {billing?.priceCents ? fmtBRL(billing.priceCents) : 'Sem assinatura'}
            {billing?.cycle && (
              <span className="text-zinc-400 dark:text-zinc-500 text-base font-bold ml-2">
                /{CYCLE_LABEL[billing.cycle].toLowerCase()}
              </span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <Field icon={Calendar} label="Próximo vencimento" value={fmtDate(billing?.nextDueDate)} />
            <Field icon={CreditCard} label="Método" value={billing?.method ? METHOD_LABEL[billing.method] : '—'} />
            <Field icon={Clock} label="Última sincronização" value={billing?.lastSyncedAt ? fmtDateTime(billing.lastSyncedAt) : '—'} />
          </div>
        </div>

        <div className="md:border-l border-zinc-200 dark:border-zinc-800 md:pl-6 flex flex-col justify-between">
          {pending ? (
            <>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                  Pagamento em aberto
                </div>
                <div className="font-display text-2xl font-black text-primary-500">
                  {fmtBRL(pending.valueCents)}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  Vence em {fmtDate(pending.dueDate)}
                </div>
              </div>
              {pending.invoiceUrl && (
                <a
                  href={pending.invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-black uppercase tracking-widest text-xs px-4 py-3 rounded-xl"
                >
                  Pagar agora <ExternalLink size={12} />
                </a>
              )}
            </>
          ) : status === 'active' || status === 'trialing' ? (
            <div className="text-center md:text-left">
              <CheckCircle2 size={28} className="text-emerald-500 mb-2 mx-auto md:mx-0" />
              <div className="font-black uppercase tracking-widest text-xs text-emerald-600 dark:text-emerald-400">
                Tudo em dia
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Nenhuma fatura em aberto no momento.
              </p>
            </div>
          ) : status === 'none' ? (
            <div className="text-center md:text-left">
              <Plug size={28} className="text-amber-500 mb-2 mx-auto md:mx-0" />
              <div className="font-black uppercase tracking-widest text-xs text-amber-600 dark:text-amber-400">
                Sem assinatura
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Entre em contato com o suporte para configurar sua mensalidade.
              </p>
            </div>
          ) : (
            <div className="text-center md:text-left">
              <CircleSlash size={28} className="text-zinc-400 mb-2 mx-auto md:mx-0" />
              <div className="font-black uppercase tracking-widest text-xs text-zinc-500">
                Assinatura cancelada
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div>
    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
      <Icon size={11} /> {label}
    </div>
    <div className="font-bold text-zinc-800 dark:text-zinc-200">{value}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Pending payment - PIX QR / boleto display
// ─────────────────────────────────────────────────────────────────────────

const PendingPaymentCard = ({ invoice }: { invoice: Invoice }) => {
  const [copied, setCopied] = useState(false);
  const method = invoice.billingType;
  const isOverdue = invoice.status === 'OVERDUE';

  const copyPix = async () => {
    if (!invoice.pixQrCode) return;
    try {
      await navigator.clipboard.writeText(invoice.pixQrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl border p-6 ${
      isOverdue
        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40'
        : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {isOverdue ? 'Fatura vencida' : 'Como pagar'}
            </span>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <div className="font-display text-2xl font-black text-zinc-900 dark:text-white">
            {fmtBRL(invoice.valueCents)}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            Vencimento: <span className="font-bold text-zinc-800 dark:text-zinc-200">{fmtDate(invoice.dueDate)}</span>
          </div>
        </div>
        {invoice.invoiceUrl && (
          <a
            href={invoice.invoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-xl"
          >
            <ExternalLink size={12} /> Página de pagamento
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(method === 'PIX' || method === 'UNDEFINED') && invoice.pixQrCode && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <QrCode size={14} className="text-primary-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">PIX copia e cola</span>
            </div>
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-[10px] font-mono break-all text-zinc-600 dark:text-zinc-400 max-h-24 overflow-y-auto">
              {invoice.pixQrCode}
            </div>
            <button
              onClick={copyPix}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 font-black uppercase tracking-widest text-xs px-3 py-2.5 rounded-xl transition-colors"
            >
              {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar código</>}
            </button>
          </div>
        )}

        {(method === 'BOLETO' || method === 'UNDEFINED') && invoice.bankSlipUrl && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} className="text-primary-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Boleto bancário</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              Baixe o PDF do boleto e pague no internet banking ou caixa eletrônico.
            </p>
            <a
              href={invoice.bankSlipUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 font-black uppercase tracking-widest text-xs px-3 py-2.5 rounded-xl transition-colors"
            >
              <FileText size={13} /> Baixar boleto
            </a>
          </div>
        )}

        {!invoice.pixQrCode && !invoice.bankSlipUrl && invoice.invoiceUrl && (
          <div className="md:col-span-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 text-xs text-zinc-500">
            Use o botão <strong className="text-zinc-700 dark:text-zinc-300">"Página de pagamento"</strong> acima para visualizar todas as formas de pagamento disponíveis no Asaas.
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Invoice history
// ─────────────────────────────────────────────────────────────────────────

const InvoicesList = ({ invoices }: { invoices: Invoice[]; onChanged: () => void }) => {
  if (!invoices.length) {
    return (
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-10 text-center">
        <Receipt size={28} className="mx-auto mb-3 text-zinc-400" />
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
          Nenhuma fatura emitida ainda
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          Quando uma cobrança for gerada pelo Asaas, ela aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <Receipt size={14} className="text-zinc-500" />
        <h2 className="font-display text-sm font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
          Histórico de faturas
        </h2>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {invoices.length} {invoices.length === 1 ? 'fatura' : 'faturas'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-[10px] font-black uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="text-left px-5 py-3">Vencimento</th>
              <th className="text-left px-5 py-3">Valor</th>
              <th className="text-left px-5 py-3">Método</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3">Pago em</th>
              <th className="text-right px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300 text-xs">
                  {fmtDate(inv.dueDate)}
                </td>
                <td className="px-5 py-3 font-mono text-zinc-800 dark:text-zinc-200">
                  {fmtBRL(inv.valueCents)}
                </td>
                <td className="px-5 py-3 text-zinc-500 text-[11px] uppercase tracking-widest">
                  {inv.billingType ? METHOD_LABEL[inv.billingType] : '—'}
                </td>
                <td className="px-5 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td className="px-5 py-3 text-zinc-500 text-xs">
                  {inv.paidAt ? fmtDate(inv.paidAt) : <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  {inv.invoiceUrl ? (
                    <a
                      href={inv.invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                    >
                      Ver <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────

const PlanBadge = ({ plan }: { plan?: TenantPlan }) => {
  const cls = plan === 'enterprise' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
    : plan === 'pro' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    : 'bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cls}`}>
      {plan || 'basic'}
    </span>
  );
};

const BillingStatusBadge = ({ status }: { status: BillingStatus }) => {
  const map: Record<BillingStatus, { label: string; cls: string; Icon: any }> = {
    active: { label: 'Em dia', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', Icon: CheckCircle2 },
    overdue: { label: 'Inadimplente', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', Icon: AlertTriangle },
    trialing: { label: 'Trial', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', Icon: TrendingUp },
    canceled: { label: 'Cancelada', cls: 'bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700', Icon: CircleSlash },
    none: { label: 'Sem plano', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', Icon: Plug },
  };
  const cfg = map[status] || map.none;
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
};

const InvoiceStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    RECEIVED: { label: 'Recebida', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    CONFIRMED: { label: 'Confirmada', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    OVERDUE: { label: 'Vencida', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
    REFUNDED: { label: 'Reembolsada', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    CANCELED: { label: 'Cancelada', cls: 'bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700' },
  };
  const cfg = map[status] || map.PENDING;
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};
