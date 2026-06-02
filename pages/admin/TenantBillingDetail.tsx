import * as React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import type { Tenant, Invoice, BillingCycle, BillingMethod, SetupFeeStatus, PlansConfigDoc } from '../../types';
import {
  X, Loader2, RefreshCw, CreditCard, Trash2, ExternalLink, AlertTriangle, CheckCircle2,
  Bell, PlusCircle, ChevronDown, ChevronUp, Calendar, Banknote, QrCode, FileText, Sparkles,
  Clock, Wallet,
} from 'lucide-react';
import { BillingStatusBadge } from './AdminBilling';
import { Select, type SelectOption } from '../../components/ui/select';
import { CurrencyInput } from '../../components/ui/currency-input';
import { TrialTimeline } from './billing/TrialTimeline';
import { Badge } from '../../components/ui/badge';
import { adminApi } from '../../services/adminApi';
import { cn } from '../../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const fmtBRL = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('pt-BR') : '—';

const CYCLES: SelectOption<BillingCycle>[] = [
  { value: 'MONTHLY', label: 'Mensal', description: 'Cobrança todo mês' },
  { value: 'QUARTERLY', label: 'Trimestral', description: 'A cada 3 meses · ~17% desconto sugerido' },
  { value: 'YEARLY', label: 'Anual', description: 'A cada 12 meses · ~25% desconto sugerido' },
];

/** Multiplicador para converter "valor por ciclo" em "valor por mês". */
function monthlyEquivFactor(cycle: BillingCycle): number {
  switch (cycle) {
    case 'YEARLY': return 1 / 12;
    case 'QUARTERLY': return 1 / 3;
    case 'MONTHLY':
    default: return 1;
  }
}

function cyclesPerYear(cycle: BillingCycle): number {
  switch (cycle) {
    case 'YEARLY': return 1;
    case 'QUARTERLY': return 4;
    case 'MONTHLY':
    default: return 12;
  }
}

/** Estima a data da próxima cobrança baseada em dueDay + trialDays. */
function previewFirstCharge(dueDay: number, trialDays: number): number {
  const base = new Date(Date.now() + Math.max(0, trialDays) * 86400000);
  base.setHours(0, 0, 0, 0);
  // Se trial > 0, simplesmente trialEndsAt; senão alinha ao próximo dueDay.
  if (trialDays > 0) return base.getTime();
  const target = new Date(base.getFullYear(), base.getMonth(), Math.min(28, Math.max(1, dueDay)));
  if (target.getTime() <= base.getTime()) {
    target.setMonth(target.getMonth() + 1);
  }
  return target.getTime();
}

const METHODS: SelectOption<BillingMethod>[] = [
  { value: 'UNDEFINED', label: 'Cliente escolhe', description: 'Asaas exibe PIX, boleto e cartão', icon: <CreditCard size={14} /> },
  { value: 'PIX', label: 'PIX', description: 'QR Code e copia-e-cola', icon: <QrCode size={14} /> },
  { value: 'BOLETO', label: 'Boleto', description: 'Bancário com código de barras', icon: <FileText size={14} /> },
  { value: 'CREDIT_CARD', label: 'Cartão', description: 'Cobrança recorrente automática', icon: <Banknote size={14} /> },
];

type Props = {
  tenant: Tenant;
  onClose: () => void;
};

export const TenantBillingDetail = ({ tenant, onClose }: Props) => {
  const billing = tenant.billing;
  const hasSubscription = !!billing?.asaasSubscriptionId;
  const hasCustomer = !!billing?.asaasCustomerId;

  const [form, setForm] = useState({
    priceCents: billing?.priceCents ?? planDefaultPrice(tenant.plan),
    cycle: (billing?.cycle ?? 'MONTHLY') as BillingCycle,
    billingType: (billing?.method ?? 'UNDEFINED') as BillingMethod,
    dueDay: billing?.dueDay ?? 10,
    trialDays: 0,
    payerName: billing?.payerName ?? '',
    payerEmail: billing?.payerEmail ?? '',
    payerCpfCnpj: billing?.payerCpfCnpj ?? '',
  });

  // Estado da seção "Adesão" — só usado na criação.
  const [setupFee, setSetupFee] = useState<{
    enabled: boolean;
    valueCents: number;
    status: 'paid' | 'pending';
    billingType: BillingMethod;
    description: string;
  }>({
    enabled: false,
    valueCents: 0,
    status: 'pending',
    billingType: 'UNDEFINED',
    description: '',
  });

  // Plans config carregada do backend para pré-preenchimento.
  const [plansConfig, setPlansConfig] = useState<PlansConfigDoc | null>(null);

  // Carrega configuração de planos para pré-preencher valores na criação.
  useEffect(() => {
    if (hasSubscription) return; // edição: usa o que já está salvo
    let cancelled = false;
    (async () => {
      try {
        const { plans } = await adminApi.getPlansConfig();
        if (cancelled) return;
        setPlansConfig(plans);
        const planConfig = plans[tenant.plan || 'basic'];
        if (planConfig) {
          setForm(prev => ({
            ...prev,
            priceCents: prev.priceCents || planConfig.priceCents,
            dueDay: prev.dueDay || planConfig.defaultDueDay || 10,
          }));
          if (planConfig.defaultSetupFeeCents && planConfig.defaultSetupFeeCents > 0) {
            setSetupFee(prev => ({
              ...prev,
              enabled: true,
              valueCents: planConfig.defaultSetupFeeCents || 0,
              description: `Taxa de adesão — plano ${planConfig.name}`,
            }));
          }
        }
      } catch (e) {
        console.warn('[TenantBillingDetail] falha ao carregar plansConfig:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [hasSubscription, tenant.plan]);

  // Formulário de cobrança avulsa
  const [chargeForm, setChargeForm] = useState({
    valueCents: 0,
    description: '',
    billingType: 'UNDEFINED' as BillingMethod,
    dueDateMs: Date.now() + 7 * 86400000,
  });
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [chargingInvoice, setChargingInvoice] = useState<string | null>(null); // paymentId sendo lembrado

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

  // Trava o scroll da página enquanto o modal está aberto (evita layout shift).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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
        if (form.trialDays > 0) payload.trialDays = form.trialDays;
        if (setupFee.enabled && setupFee.valueCents >= 100) {
          payload.setupFee = {
            valueCents: setupFee.valueCents,
            status: setupFee.status,
            description: setupFee.description.trim() || undefined,
            billingType: setupFee.status === 'pending' ? setupFee.billingType : undefined,
          };
        }
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

  const remind = async (paymentId: string) => {
    if (!functions || chargingInvoice) return;
    setChargingInvoice(paymentId);
    setError(''); setInfo('');
    try {
      const fn = httpsCallable(functions, 'remindTenantPayment');
      await fn({ slug: tenant.slug, paymentId });
      setInfo('Lembrete enviado com sucesso.');
    } catch (e: any) {
      setError(e?.message || 'Falha ao enviar lembrete.');
    } finally {
      setChargingInvoice(null);
    }
  };

  const createCharge = async () => {
    if (!functions) return;
    setError(''); setInfo(''); setSubmitting(true);
    try {
      const fn = httpsCallable(functions, 'createOneTimeCharge');
      await fn({
        slug: tenant.slug,
        valueCents: chargeForm.valueCents,
        description: chargeForm.description,
        billingType: chargeForm.billingType,
        dueDateMs: chargeForm.dueDateMs,
      });
      setInfo('Cobrança avulsa criada com sucesso.');
      setShowChargeForm(false);
      setChargeForm({ valueCents: 0, description: '', billingType: 'UNDEFINED', dueDateMs: Date.now() + 7 * 86400000 });
      await loadInvoices();
    } catch (e: any) {
      setError(e?.message || 'Falha ao criar cobrança.');
    } finally {
      setSubmitting(false);
    }
  };

  const canRemind = (inv: Invoice) => inv.status === 'PENDING' || inv.status === 'OVERDUE';

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="relative bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl sm:my-8 max-h-[100dvh] sm:max-h-[90vh] flex flex-col shadow-2xl shadow-black/50 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 w-72 h-72 rounded-full bg-amber-500/10 blur-[100px]" />
        <header className="relative shrink-0 flex items-start justify-between gap-4 p-4 sm:p-6 border-b border-white/5">
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

        <div className="relative flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
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

          {/* Assinatura recorrente */}
          <section>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Plano + cobrança</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Valor" hint="Mínimo R$ 5,00">
                <CurrencyInput
                  value={form.priceCents}
                  onChange={(cents) => setForm({ ...form, priceCents: cents })}
                  minCents={500}
                />
              </Field>
              <Field label="Ciclo">
                <Select<BillingCycle>
                  value={form.cycle}
                  onChange={(v) => setForm({ ...form, cycle: v })}
                  options={CYCLES}
                  leftIcon={<Calendar size={14} />}
                />
              </Field>
              <Field label="Método de pagamento">
                <Select<BillingMethod>
                  value={form.billingType}
                  onChange={(v) => setForm({ ...form, billingType: v })}
                  options={METHODS}
                />
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

            <BillingPreview
              priceCents={form.priceCents}
              cycle={form.cycle}
              dueDay={form.dueDay}
              trialDays={hasSubscription ? 0 : form.trialDays}
              isUpdate={hasSubscription}
            />
          </section>

          {/* Dados do pagador + trial (só na criação) */}
          {!hasSubscription && (
            <section>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Dados do pagador</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome / Razão social">
                  <input value={form.payerName} onChange={e => setForm({ ...form, payerName: e.target.value })} className={inputCls} required />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.payerEmail} onChange={e => setForm({ ...form, payerEmail: e.target.value })} className={inputCls} required />
                </Field>
                <Field label="CPF / CNPJ" hint="Somente números">
                  <input value={form.payerCpfCnpj} onChange={e => setForm({ ...form, payerCpfCnpj: e.target.value.replace(/\D/g, '') })} className={inputCls} required />
                </Field>
                <Field label="Período de trial" hint="0 = sem trial (cobrança imediata)">
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="90"
                      value={form.trialDays}
                      onChange={e => setForm({ ...form, trialDays: Math.max(0, Math.min(90, Number(e.target.value))) })}
                      className={inputCls}
                    />
                    <span className="text-zinc-500 text-xs shrink-0">dias</span>
                  </div>
                </Field>
              </div>
            </section>
          )}

          {/* Adesão / setup fee (criação) */}
          {!hasSubscription && (
            <SetupFeeSection
              state={setupFee}
              onChange={setSetupFee}
              suggestedFromPlan={plansConfig?.[tenant.plan]?.defaultSetupFeeCents}
            />
          )}

          {/* Status da adesão já registrada */}
          {hasSubscription && billing?.setupFee && (
            <SetupFeeBadgeCard
              setupFee={billing.setupFee}
              tenantSlug={tenant.slug}
              onMarkedPaid={async () => {
                try {
                  await adminApi.markSetupFeePaid(tenant.slug);
                  setInfo('Adesão marcada como paga.');
                } catch (e: any) { setError(e?.message || 'Falha ao atualizar adesão.'); }
              }}
            />
          )}

          {/* Timeline do trial em andamento */}
          {hasSubscription && billing?.trialEndsAt && billing.trialEndsAt > Date.now() && (
            <TrialTimeline
              startedAt={billing.lastSyncedAt ? billing.lastSyncedAt - ((billing.trialDays || 7) * 86400000) : Date.now() - (billing.trialDays || 7) * 86400000}
              trialEndsAt={billing.trialEndsAt}
              trialDays={billing.trialDays}
            />
          )}

          {/* Faturas + ações por fatura */}
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
                        <th className="text-right px-4 py-2.5">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id} className="border-t border-white/5">
                          <td className="px-4 py-2.5 text-zinc-300">{fmtDate(inv.dueDate)}</td>
                          <td className="px-4 py-2.5 font-mono">{fmtBRL(inv.valueCents)}</td>
                          <td className="px-4 py-2.5"><InvoiceStatusBadge status={inv.status} /></td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              {canRemind(inv) && (
                                <button
                                  onClick={() => remind(inv.id)}
                                  disabled={!!chargingInvoice}
                                  title="Reenviar lembrete de pagamento ao cliente"
                                  className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 disabled:opacity-40"
                                >
                                  {chargingInvoice === inv.id
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : <Bell size={11} />}
                                  Lembrar
                                </button>
                              )}
                              {inv.invoiceUrl && (
                                <a href={inv.invoiceUrl} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {/* Cobrança avulsa */}
          {hasCustomer && (
            <section>
              <button
                onClick={() => setShowChargeForm(v => !v)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-amber-400 transition-colors"
              >
                <PlusCircle size={13} />
                Nova cobrança avulsa
                {showChargeForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {showChargeForm && (
                <div className="mt-3 bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Valor">
                      <CurrencyInput
                        value={chargeForm.valueCents}
                        onChange={(cents) => setChargeForm({ ...chargeForm, valueCents: cents })}
                        minCents={100}
                      />
                    </Field>
                    <Field label="Método">
                      <Select<BillingMethod>
                        value={chargeForm.billingType}
                        onChange={(v) => setChargeForm({ ...chargeForm, billingType: v })}
                        options={METHODS}
                      />
                    </Field>
                    <Field label="Vencimento">
                      <input
                        type="date"
                        value={new Date(chargeForm.dueDateMs).toISOString().slice(0, 10)}
                        onChange={e => setChargeForm({ ...chargeForm, dueDateMs: new Date(e.target.value).getTime() })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Descrição">
                      <input
                        value={chargeForm.description}
                        onChange={e => setChargeForm({ ...chargeForm, description: e.target.value })}
                        placeholder="Ex: Taxa de setup"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <button
                    onClick={createCharge}
                    disabled={submitting || !chargeForm.description || chargeForm.valueCents < 100}
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-xl"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={13} /> : <PlusCircle size={13} />}
                    Gerar cobrança
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="relative shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-t border-white/5 bg-zinc-950/40">
          <div className="text-[10px] text-zinc-600">
            {billing?.lastSyncedAt && <>Última sincronização: {new Date(billing.lastSyncedAt).toLocaleString('pt-BR')}</>}
            {billing?.trialEndsAt && (
              <span className="ml-3 text-amber-500">
                Trial até {new Date(billing.trialEndsAt).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
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
    </div>,
    document.body,
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

/** Preview do impacto financeiro do plano configurado. */
const BillingPreview = ({
  priceCents, cycle, dueDay, trialDays, isUpdate,
}: {
  priceCents: number;
  cycle: BillingCycle;
  dueDay: number;
  trialDays: number;
  isUpdate: boolean;
}) => {
  if (!priceCents) return null;
  const monthly = Math.round(priceCents * monthlyEquivFactor(cycle));
  const annual = monthly * 12;
  const perYear = cyclesPerYear(cycle);
  const firstChargeMs = previewFirstCharge(dueDay, trialDays);

  const fmt = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDay = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-amber-500/5 border border-amber-500/15 rounded-2xl p-3">
      <PreviewRow label={isUpdate ? 'Próxima cobrança' : '1ª cobrança'} value={fmtDay(firstChargeMs)} sub={trialDays > 0 ? `após ${trialDays} dias de trial` : `dia ${dueDay} do mês`} />
      <PreviewRow label="Equivalente mensal" value={fmt(monthly)} sub={cycle === 'MONTHLY' ? 'cobrado mensalmente' : `${perYear} cobranças/ano de ${fmt(priceCents)}`} />
      <PreviewRow label="Projeção anual" value={fmt(annual)} sub={`${perYear} cobranças × ${fmt(priceCents)}`} />
    </div>
  );
};

const PreviewRow = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="px-2 py-1.5">
    <div className="text-[9px] font-black uppercase tracking-widest text-amber-500/70">{label}</div>
    <div className="text-sm font-display font-black text-amber-300 truncate">{value}</div>
    {sub && <div className="text-[10px] text-zinc-500 truncate">{sub}</div>}
  </div>
);

function planDefaultPrice(plan?: string): number {
  switch (plan) {
    case 'enterprise': return 99900;
    case 'pro': return 29900;
    default: return 9900;
  }
}

// ============================================================
// SETUP FEE — UI components
// ============================================================

interface SetupFeeFormState {
  enabled: boolean;
  valueCents: number;
  status: 'paid' | 'pending';
  billingType: BillingMethod;
  description: string;
}

const SetupFeeSection = ({
  state, onChange, suggestedFromPlan,
}: {
  state: SetupFeeFormState;
  onChange: (s: SetupFeeFormState) => void;
  suggestedFromPlan?: number;
}) => {
  const fmt = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <section className="bg-amber-500/[0.03] border border-amber-500/15 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1 flex items-center gap-1.5">
            <Sparkles size={11} /> Adesão (taxa única de setup)
          </h4>
          <p className="text-[11px] text-zinc-400">
            Valor cobrado uma única vez na entrada. Independente da mensalidade recorrente.
          </p>
        </div>
        <Toggle
          checked={state.enabled}
          onChange={(checked) => onChange({ ...state, enabled: checked, valueCents: checked ? (state.valueCents || suggestedFromPlan || 0) : state.valueCents })}
          label={state.enabled ? 'Cobrar' : 'Sem adesão'}
        />
      </div>

      <AnimatePresence initial={false}>
        {state.enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
                    Valor da adesão
                  </label>
                  <CurrencyInput
                    value={state.valueCents}
                    onChange={(cents) => onChange({ ...state, valueCents: cents })}
                    minCents={100}
                  />
                  {suggestedFromPlan && suggestedFromPlan > 0 && state.valueCents !== suggestedFromPlan && (
                    <button
                      type="button"
                      onClick={() => onChange({ ...state, valueCents: suggestedFromPlan })}
                      className="text-[10px] text-amber-500/80 hover:text-amber-400 mt-1"
                    >
                      Usar sugerido do plano: <span className="font-mono">{fmt(suggestedFromPlan)}</span>
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
                    Descrição (opcional)
                  </label>
                  <input
                    value={state.description}
                    onChange={(e) => onChange({ ...state, description: e.target.value })}
                    placeholder="Ex: Setup + treinamento"
                    className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-xl px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
                  Status do pagamento
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <PaymentStatusOption
                    active={state.status === 'paid'}
                    onClick={() => onChange({ ...state, status: 'paid' })}
                    icon={<CheckCircle2 size={14} />}
                    tone="emerald"
                    title="Já está pago"
                    description="Apenas registra. Não gera cobrança no Asaas."
                  />
                  <PaymentStatusOption
                    active={state.status === 'pending'}
                    onClick={() => onChange({ ...state, status: 'pending' })}
                    icon={<Clock size={14} />}
                    tone="amber"
                    title="Aguardando pagamento"
                    description="Gera fatura avulsa no Asaas (vence em 7 dias)."
                  />
                </div>
              </div>

              {state.status === 'pending' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
                    Método de pagamento da adesão
                  </label>
                  <Select<BillingMethod>
                    value={state.billingType}
                    onChange={(v) => onChange({ ...state, billingType: v })}
                    options={METHODS}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const PaymentStatusOption = ({
  active, onClick, icon, tone, title, description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  tone: 'emerald' | 'amber';
  title: string;
  description: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'text-left px-3 py-2.5 rounded-xl border transition-all',
      active
        ? tone === 'emerald'
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-amber-500/40 bg-amber-500/5'
        : 'border-white/5 hover:border-white/10 bg-white/[0.02]',
    )}
  >
    <div className={cn(
      'flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest mb-1',
      active
        ? tone === 'emerald' ? 'text-emerald-400' : 'text-amber-400'
        : 'text-zinc-400',
    )}>
      {icon} {title}
    </div>
    <p className="text-[10px] text-zinc-500 leading-relaxed">{description}</p>
  </button>
);

const Toggle = ({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={cn(
        'relative w-10 h-5 rounded-full transition-colors border',
        checked ? 'bg-amber-500 border-amber-400' : 'bg-white/[0.04] border-white/10',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  </label>
);

const SetupFeeBadgeCard = ({
  setupFee, tenantSlug, onMarkedPaid,
}: {
  setupFee: { valueCents: number; status: SetupFeeStatus; description?: string; registeredAt: number; paidAt?: number; asaasPaymentId?: string };
  tenantSlug: string;
  onMarkedPaid: () => Promise<void>;
}) => {
  const [marking, setMarking] = useState(false);
  const fmt = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const isPending = setupFee.status === 'pending';
  const isPaid = setupFee.status === 'paid';

  const handleMark = async () => {
    setMarking(true);
    try { await onMarkedPaid(); }
    finally { setMarking(false); }
  };

  return (
    <section className={cn(
      'rounded-2xl p-4 border space-y-2',
      isPaid && 'bg-emerald-500/[0.04] border-emerald-500/20',
      isPending && 'bg-amber-500/[0.04] border-amber-500/20',
      setupFee.status === 'waived' && 'bg-white/[0.02] border-white/5',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
            isPaid && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
            isPending && 'bg-amber-500/15 text-amber-400 border-amber-500/30',
            setupFee.status === 'waived' && 'bg-white/[0.04] text-zinc-400 border-white/10',
          )}>
            <Wallet size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-widest text-zinc-200">Adesão</h4>
              <Badge tone={isPaid ? 'emerald' : isPending ? 'amber' : 'neutral'}>
                {isPaid ? 'Paga' : isPending ? 'Pendente' : 'Isenta'}
              </Badge>
            </div>
            <div className="font-mono text-sm text-white mt-0.5">{fmt(setupFee.valueCents)}</div>
            {setupFee.description && (
              <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{setupFee.description}</div>
            )}
          </div>
        </div>
        {isPending && (
          <button
            type="button"
            onClick={handleMark}
            disabled={marking}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
          >
            {marking ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
            Marcar pago
          </button>
        )}
      </div>
      <div className="text-[10px] text-zinc-500 flex items-center gap-3 pt-1 border-t border-white/5">
        <span>Registrada em {new Date(setupFee.registeredAt).toLocaleDateString('pt-BR')}</span>
        {setupFee.paidAt && <span className="text-emerald-400/70">· Paga em {new Date(setupFee.paidAt).toLocaleDateString('pt-BR')}</span>}
        {setupFee.asaasPaymentId && (
          <code className="ml-auto text-[9px] text-zinc-600">#{setupFee.asaasPaymentId.slice(-6)}</code>
        )}
      </div>
    </section>
  );
};

