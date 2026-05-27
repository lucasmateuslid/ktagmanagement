import * as React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CalendarClock, CreditCard } from 'lucide-react';

interface TrialTimelineProps {
  /** Quando o tenant foi criado / trial começou. Epoch ms. */
  startedAt: number;
  /** Quando o trial expira (= data da 1ª cobrança). Epoch ms. */
  trialEndsAt: number;
  /** Total de dias contratado (calculado se omitido). */
  trialDays?: number;
}

const fmt = (ms: number) =>
  new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Mostra o ciclo do trial em 3 marcos: início, hoje, primeira cobrança.
 * A barra preenche conforme o progresso do tempo.
 */
export const TrialTimeline = ({ startedAt, trialEndsAt, trialDays }: TrialTimelineProps) => {
  const now = Date.now();
  const totalMs = trialEndsAt - startedAt;
  const elapsedMs = Math.max(0, Math.min(totalMs, now - startedAt));
  const pct = totalMs > 0 ? Math.round((elapsedMs / totalMs) * 100) : 100;
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt - now) / 86400000));
  const totalDays = trialDays ?? Math.max(1, Math.ceil(totalMs / 86400000));

  const expired = now >= trialEndsAt;

  return (
    <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            {expired ? 'Trial finalizado' : `Trial · ${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'}`}
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">
          {totalDays} {totalDays === 1 ? 'dia' : 'dias'} no total
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="relative h-1.5 rounded-full bg-amber-500/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
        />
      </div>

      {/* Marcos */}
      <div className="flex items-stretch justify-between text-[10px] uppercase tracking-widest font-bold">
        <Milestone
          icon={<CalendarClock size={11} />}
          label="Início"
          date={fmt(startedAt)}
          active
          align="start"
        />
        <Milestone
          icon={<Sparkles size={11} />}
          label="Hoje"
          date={fmt(now)}
          active={!expired}
          align="center"
        />
        <Milestone
          icon={<CreditCard size={11} />}
          label="1ª cobrança"
          date={fmt(trialEndsAt)}
          active={expired}
          highlight
          align="end"
        />
      </div>
    </div>
  );
};

const Milestone = ({
  icon, label, date, active, highlight, align,
}: {
  icon: React.ReactNode;
  label: string;
  date: string;
  active?: boolean;
  highlight?: boolean;
  align: 'start' | 'center' | 'end';
}) => (
  <div className={`flex flex-col gap-1 ${align === 'center' ? 'items-center' : align === 'end' ? 'items-end' : 'items-start'}`}>
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
      highlight ? 'bg-amber-500/15 text-amber-400'
        : active ? 'text-amber-500'
          : 'text-zinc-600'
    }`}>
      {icon} <span className="text-[9px]">{label}</span>
    </div>
    <span className={`text-[10px] font-mono ${active ? 'text-zinc-300' : 'text-zinc-600'}`}>{date}</span>
  </div>
);
