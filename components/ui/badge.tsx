import * as React from 'react';
import { cn } from '../../lib/utils';

type Tone = 'neutral' | 'amber' | 'emerald' | 'red' | 'blue' | 'purple' | 'zinc';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Variação visual. soft = bg sutil; outline = só borda; solid = sólido. */
  variant?: 'soft' | 'outline' | 'solid';
  size?: 'xs' | 'sm';
  icon?: React.ReactNode;
}

const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-white/[0.04] text-zinc-300 border-white/10',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  zinc: 'bg-zinc-700/40 text-zinc-300 border-zinc-700',
};

const TONE_OUTLINE: Record<Tone, string> = {
  neutral: 'border-white/10 text-zinc-300',
  amber: 'border-amber-500/40 text-amber-400',
  emerald: 'border-emerald-500/40 text-emerald-400',
  red: 'border-red-500/40 text-red-400',
  blue: 'border-blue-500/40 text-blue-400',
  purple: 'border-purple-500/40 text-purple-400',
  zinc: 'border-zinc-700 text-zinc-300',
};

const TONE_SOLID: Record<Tone, string> = {
  neutral: 'bg-zinc-800 text-white border-transparent',
  amber: 'bg-amber-500 text-zinc-950 border-transparent',
  emerald: 'bg-emerald-500 text-white border-transparent',
  red: 'bg-red-500 text-white border-transparent',
  blue: 'bg-blue-500 text-white border-transparent',
  purple: 'bg-purple-500 text-white border-transparent',
  zinc: 'bg-zinc-600 text-white border-transparent',
};

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'sm',
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  const palette =
    variant === 'soft' ? TONE_SOFT[tone] :
      variant === 'outline' ? TONE_OUTLINE[tone] :
        TONE_SOLID[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-black uppercase tracking-widest border rounded-full',
        size === 'xs' && 'text-[9px] px-2 py-0.5',
        size === 'sm' && 'text-[10px] px-2.5 py-1',
        palette,
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
