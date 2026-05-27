import * as React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Largura padrão Tailwind ou número (px). */
  w?: string | number;
  /** Altura padrão Tailwind ou número (px). */
  h?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
}

/**
 * Shimmer loading placeholder com gradient animado.
 */
export function Skeleton({ className, w, h, rounded = 'xl', style, ...props }: SkeletonProps) {
  const inlineStyle: React.CSSProperties = {
    ...(typeof w === 'number' ? { width: w } : {}),
    ...(typeof h === 'number' ? { height: h } : {}),
    ...style,
  };
  return (
    <div
      aria-hidden
      style={inlineStyle}
      className={cn(
        'relative overflow-hidden bg-white/[0.04]',
        rounded === 'sm' && 'rounded-sm',
        rounded === 'md' && 'rounded-md',
        rounded === 'lg' && 'rounded-lg',
        rounded === 'xl' && 'rounded-xl',
        rounded === '2xl' && 'rounded-2xl',
        rounded === '3xl' && 'rounded-3xl',
        rounded === 'full' && 'rounded-full',
        typeof w === 'string' && w,
        typeof h === 'string' && h,
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

interface SkeletonRowsProps {
  rows?: number;
  cols?: number;
  className?: string;
}

/**
 * Helper para gerar várias linhas de skeleton em tabelas.
 */
export function SkeletonRows({ rows = 5, cols = 4, className }: SkeletonRowsProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} h={36} rounded="lg" />
          ))}
        </div>
      ))}
    </div>
  );
}
