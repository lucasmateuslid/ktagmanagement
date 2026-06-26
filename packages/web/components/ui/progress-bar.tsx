import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  /** Valor atual. */
  value: number;
  /** Valor máximo. */
  max: number;
  /** Mostrar label com "X / Y". */
  showLabel?: boolean;
  /** Mostrar percentual. */
  showPercent?: boolean;
  /** Tamanho da barra. */
  size?: 'sm' | 'md' | 'lg';
  /** Sufixo (ex: "tags"). */
  unit?: string;
  className?: string;
}

function getTone(pct: number): {
  bar: string;
  text: string;
  ring: string;
  label: string;
} {
  if (pct >= 100) return {
    bar: 'from-red-500 to-red-600',
    text: 'text-red-400',
    ring: 'ring-red-500/30',
    label: 'Limite atingido',
  };
  if (pct >= 80) return {
    bar: 'from-amber-400 to-orange-500',
    text: 'text-amber-400',
    ring: 'ring-amber-500/30',
    label: 'Próximo do limite',
  };
  if (pct >= 50) return {
    bar: 'from-amber-500/80 to-amber-600/80',
    text: 'text-amber-500',
    ring: 'ring-amber-500/10',
    label: 'Uso saudável',
  };
  return {
    bar: 'from-emerald-500 to-teal-500',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/10',
    label: 'Uso baixo',
  };
}

export function ProgressBar({
  value,
  max,
  showLabel = true,
  showPercent = true,
  size = 'md',
  unit,
  className,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tone = getTone(pct);

  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' } as const;

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono text-zinc-400">
            {value.toLocaleString('pt-BR')} <span className="text-zinc-600">/</span> {max.toLocaleString('pt-BR')}
            {unit && <span className="text-zinc-600 ml-1">{unit}</span>}
          </span>
          {showPercent && (
            <span className={cn('text-[10px] font-black uppercase tracking-widest', tone.text)}>
              {pct}%
            </span>
          )}
        </div>
      )}
      <div className={cn('relative w-full overflow-hidden rounded-full bg-white/[0.04] ring-1', heights[size], tone.ring)}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={cn('h-full rounded-full bg-gradient-to-r', tone.bar)}
        />
      </div>
    </div>
  );
}

interface UsageBadgeProps {
  value: number;
  max: number;
  className?: string;
}

/**
 * Badge inline (X / Y) com cor do tone baseado na %.
 */
export function UsageBadge({ value, max, className }: UsageBadgeProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tone = getTone(pct);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest',
        tone.text,
        pct >= 100 ? 'bg-red-500/10 border-red-500/30' :
          pct >= 80 ? 'bg-amber-500/10 border-amber-500/30' :
            'bg-white/[0.03] border-white/10',
        className,
      )}
    >
      <span className="font-mono">{value}/{max}</span>
      <span className="text-zinc-500">·</span>
      <span>{pct}%</span>
    </span>
  );
}
