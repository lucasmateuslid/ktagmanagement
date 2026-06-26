import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Loader2, Save, AlertTriangle, CheckCircle2, Zap, Rocket, Crown, Sparkles, Tag as TagIcon, Users,
  Calendar, X, Plus, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi, type PlanConfig, type PlansConfigDoc } from '../../services/adminApi';
import { CurrencyInput } from '../../components/ui/currency-input';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import type { TenantPlan } from '../../types';
import { cn } from '../../lib/utils';

const PLAN_META: Record<TenantPlan, { label: string; tone: 'amber' | 'blue' | 'purple'; Icon: any; gradient: string; description: string }> = {
  basic: {
    label: 'Basic',
    tone: 'amber',
    Icon: Zap,
    gradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
    description: 'Plano de entrada — recursos essenciais',
  },
  pro: {
    label: 'Pro',
    tone: 'blue',
    Icon: Rocket,
    gradient: 'from-blue-500/15 via-blue-500/5 to-transparent',
    description: 'Mais limites e integrações',
  },
  enterprise: {
    label: 'Enterprise',
    tone: 'purple',
    Icon: Crown,
    gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
    description: 'Limites altos + SLA',
  },
};

const PLAN_ORDER: TenantPlan[] = ['basic', 'pro', 'enterprise'];

interface DraftPlan {
  priceCents: number;
  maxUsers: number;
  defaultLimiteTags: number;
  defaultSetupFeeCents: number;
  defaultDueDay: number;
  features: string[];
}

type Draft = Record<TenantPlan, DraftPlan>;

function toDraft(plans: PlansConfigDoc | null): Draft | null {
  if (!plans) return null;
  return PLAN_ORDER.reduce((acc, id) => {
    const p = plans[id];
    acc[id] = {
      priceCents: p?.priceCents ?? 0,
      maxUsers: p?.maxUsers ?? 0,
      defaultLimiteTags: p?.defaultLimiteTags ?? 0,
      defaultSetupFeeCents: p?.defaultSetupFeeCents ?? 0,
      defaultDueDay: p?.defaultDueDay ?? 10,
      features: Array.isArray(p?.features) ? [...p.features] : [],
    };
    return acc;
  }, {} as Draft);
}

function draftsEqual(a: Draft | null, b: Draft | null): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

export const AdminPlansConfig = () => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | undefined>();
  const [fromDefaults, setFromDefaults] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getPlansConfig();
      const d = toDraft(res.plans);
      setDraft(d);
      setBaseline(d);
      setUpdatedAt(res.plans.updatedAt);
      setFromDefaults(res.fromDefaults);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar planos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dirty = !draftsEqual(draft, baseline);

  const updatePlan = (id: TenantPlan, patch: Partial<DraftPlan>) => {
    setDraft(prev => prev ? { ...prev, [id]: { ...prev[id], ...patch } } : prev);
    setSuccess('');
  };

  const save = async () => {
    if (!draft || !dirty) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = PLAN_ORDER.reduce((acc, id) => {
        const d = draft[id];
        acc[id] = {
          id,
          name: PLAN_META[id].label,
          priceCents: d.priceCents,
          maxUsers: d.maxUsers,
          defaultLimiteTags: d.defaultLimiteTags,
          defaultSetupFeeCents: d.defaultSetupFeeCents,
          defaultDueDay: d.defaultDueDay,
          features: d.features,
        } as PlanConfig;
        return acc;
      }, {} as Pick<PlansConfigDoc, 'basic' | 'pro' | 'enterprise'>);
      const res = await adminApi.updatePlansConfig(payload);
      setBaseline(draft);
      setUpdatedAt(res.plans.updatedAt);
      setFromDefaults(false);
      setSuccess('Configuração de planos salva com sucesso.');
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setDraft(baseline);
    setSuccess('');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest">Planos</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Valores base e limites por plano · pré-preenchem novas assinaturas
            {updatedAt && !fromDefaults && (
              <span className="ml-2 text-zinc-600">· atualizado em {new Date(updatedAt).toLocaleString('pt-BR')}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={revert}
            disabled={!dirty || saving}
            className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white px-4 py-2.5 rounded-xl border border-white/5 hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
          >
            Reverter
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
              dirty && !saving
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20'
                : 'bg-amber-500/20 text-amber-300/60 cursor-not-allowed',
            )}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar alterações
          </button>
        </div>
      </header>

      {/* Feedback alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3"
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 rounded-xl px-4 py-3"
          >
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{success}</span>
          </motion.div>
        )}
        {fromDefaults && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 text-sm text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3"
          >
            <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <span>
              <strong className="text-amber-200">Configuração ainda não salva.</strong> Os valores exibidos são padrões do sistema.
              Salve agora para que novas assinaturas usem seus preços.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {loading || !draft ? (
          PLAN_ORDER.map(id => <PlanCardSkeleton key={id} />)
        ) : (
          PLAN_ORDER.map(id => (
            <PlanCard
              key={id}
              id={id}
              plan={draft[id]}
              onChange={(patch) => updatePlan(id, patch)}
            />
          ))
        )}
      </div>
    </div>
  );
};

const PlanCardSkeleton = () => (
  <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 space-y-4">
    <Skeleton w={120} h={20} />
    <Skeleton w={180} h={36} />
    <Skeleton h={48} />
    <Skeleton h={48} />
    <Skeleton h={48} />
  </div>
);

const PlanCard = ({
  id, plan, onChange,
}: {
  id: TenantPlan;
  plan: DraftPlan;
  onChange: (patch: Partial<DraftPlan>) => void;
}) => {
  const meta = PLAN_META[id];
  const { Icon } = meta;
  const monthly = plan.priceCents;
  const annualEquiv = monthly * 12;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="relative bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 overflow-hidden"
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br pointer-events-none', meta.gradient)} />

      <div className="relative space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center border',
              meta.tone === 'amber' && 'bg-amber-500/15 text-amber-400 border-amber-500/30',
              meta.tone === 'blue' && 'bg-blue-500/15 text-blue-400 border-blue-500/30',
              meta.tone === 'purple' && 'bg-purple-500/15 text-purple-400 border-purple-500/30',
            )}>
              <Icon size={18} />
            </div>
            <div>
              <h2 className="font-display font-black text-base uppercase tracking-widest">{meta.label}</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">{meta.description}</p>
            </div>
          </div>
          <Badge tone={meta.tone}>{id}</Badge>
        </div>

        {/* Preço mensal — destaque */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
            Mensalidade base
          </label>
          <CurrencyInput
            value={plan.priceCents}
            onChange={(cents) => onChange({ priceCents: cents })}
            minCents={100}
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            Equivalente anual: <span className="font-mono text-zinc-400">{((annualEquiv) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </p>
        </div>

        {/* Adesão */}
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
            <Sparkles size={11} /> Adesão (setup fee)
          </label>
          <CurrencyInput
            value={plan.defaultSetupFeeCents}
            onChange={(cents) => onChange({ defaultSetupFeeCents: cents })}
            minCents={0}
          />
          <p className="text-[10px] text-zinc-600 mt-1">0 = sem adesão por padrão</p>
        </div>

        {/* Grid: limites */}
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Limite tags"
            icon={<TagIcon size={11} />}
            value={plan.defaultLimiteTags}
            onChange={(v) => onChange({ defaultLimiteTags: v })}
            hint="0 = ilimitado"
            min={0}
          />
          <NumField
            label="Máx. usuários"
            icon={<Users size={11} />}
            value={plan.maxUsers}
            onChange={(v) => onChange({ maxUsers: v })}
            hint="0 = ilimitado"
            min={0}
          />
        </div>

        <NumField
          label="Dia do vencimento sugerido"
          icon={<Calendar size={11} />}
          value={plan.defaultDueDay}
          onChange={(v) => onChange({ defaultDueDay: Math.min(28, Math.max(1, v)) })}
          hint="1 a 28"
          min={1}
          max={28}
        />

        {/* Features (lista editável) */}
        <FeatureList
          features={plan.features}
          onChange={(features) => onChange({ features })}
        />
      </div>
    </motion.div>
  );
};

const NumField = ({
  label, icon, value, onChange, hint, min, max,
}: {
  label: string;
  icon?: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
}) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
      {icon} {label}
    </label>
    <input
      type="number"
      min={min}
      max={max}
      value={value || ''}
      onChange={(e) => onChange(Math.max(min ?? 0, Number(e.target.value) || 0))}
      placeholder={min === 0 ? '0 (ilimitado)' : ''}
      className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-xl px-3 py-2.5 text-sm font-mono outline-none transition-colors placeholder:text-zinc-600"
    />
    {hint && <div className="text-[10px] text-zinc-600 mt-1">{hint}</div>}
  </div>
);

const FeatureList = ({
  features, onChange,
}: { features: string[]; onChange: (v: string[]) => void }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (features.includes(v)) return;
    onChange([...features, v]);
    setDraft('');
  };
  const remove = (f: string) => onChange(features.filter(x => x !== f));

  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">
        Features incluídas
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {features.length === 0 && (
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold italic">Nenhuma feature listada</span>
        )}
        {features.map(f => (
          <span key={f} className="inline-flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-[11px] text-zinc-300 font-mono">
            {f}
            <button
              type="button"
              onClick={() => remove(f)}
              className="text-zinc-500 hover:text-red-400 transition-colors"
              aria-label={`Remover ${f}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Ex: API_ACCESS, WHATSAPP, etc"
          className="flex-1 bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none placeholder:text-zinc-600 transition-colors"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 text-amber-400 border border-amber-500/20 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
};
