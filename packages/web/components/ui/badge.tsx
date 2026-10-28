import * as React from 'react';
import { cn } from '../../lib/utils';

type Tone = 'neutral' | 'accent' | 'amber' | 'emerald' | 'red' | 'blue' | 'purple' | 'zinc';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Variação visual. soft = bg sutil; outline = só borda; solid = sólido. */
  variant?: 'soft' | 'outline' | 'solid';
  size?: 'xs' | 'sm';
  icon?: React.ReactNode;
}

// `amber` é alias legado de `accent` (cor de marca, respeita whitelabel via primary-*).
const ACCENT_SOFT = 'bg-primary-500/10 text-primary-700 dark:text-primary-400 border-primary-500/20';
const ACCENT_OUTLINE = 'border-primary-500/40 text-primary-700 dark:text-primary-400';

const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg-2 border-line',
  accent: ACCENT_SOFT,
  amber: ACCENT_SOFT,
  emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  zinc: 'bg-zinc-500/10 text-fg-2 border-line',
};

const TONE_OUTLINE: Record<Tone, string> = {
  neutral: 'border-line text-fg-2',
  accent: ACCENT_OUTLINE,
  amber: ACCENT_OUTLINE,
  emerald: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  red: 'border-red-500/40 text-red-600 dark:text-red-400',
  blue: 'border-blue-500/40 text-blue-700 dark:text-blue-400',
  purple: 'border-purple-500/40 text-purple-700 dark:text-purple-400',
  zinc: 'border-line text-fg-2',
};

const TONE_SOLID: Record<Tone, string> = {
  neutral: 'bg-zinc-800 text-white border-transparent',
  accent: 'bg-accent text-fg-on-accent border-transparent',
  amber: 'bg-accent text-fg-on-accent border-transparent',
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
        size === 'xs' && 'text-2xs px-2 py-0.5',
        size === 'sm' && 'text-2xs px-2.5 py-1',
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
