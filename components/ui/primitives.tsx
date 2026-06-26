import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Primitivos de assinatura do design system Monitora 360.
 * Encapsulam os padrões recorrentes (eyebrow, header de seção, icon tile,
 * KPI card, status dot) consumindo os tokens/classes .m-* de index.css.
 * Use-os em telas novas para manter consistência sem repetir Tailwind.
 */

/* ---- Eyebrow: micro-label 10px / 0.3em uppercase (assinatura) ---- */
export function Eyebrow({
  accent,
  danger,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { accent?: boolean; danger?: boolean }) {
  return (
    <span
      className={cn(
        'm-eyebrow',
        accent && 'm-eyebrow-accent',
        danger && 'text-red-500',
        className,
      )}
      {...props}
    />
  );
}

/* ---- SectionHeader: barra âmbar 4×16 + eyebrow sobre hairline ---- */
export function SectionHeader({
  variant = 'accent',
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: 'accent' | 'neutral' | 'danger' }) {
  return (
    <div className={cn('m-section-head', className)} {...props}>
      <span
        className={cn(
          'm-section-head__bar',
          variant === 'neutral' && 'm-section-head__bar--neutral',
          variant === 'danger' && 'm-section-head__bar--danger',
        )}
      />
      <Eyebrow accent={variant === 'accent'} danger={variant === 'danger'}>
        {children}
      </Eyebrow>
    </div>
  );
}

/* ---- IconTile: o tile de ícone no canto superior do card (motif quase universal) ---- */
export function IconTile({
  icon,
  variant = 'neutral',
  className,
}: {
  icon: React.ReactNode;
  variant?: 'neutral' | 'dark' | 'accent';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-2xl p-3 shrink-0',
        variant === 'neutral' && 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400',
        variant === 'dark' && 'bg-zinc-800 text-zinc-300',
        variant === 'accent' && 'bg-primary-500/5 border border-primary-500/30 text-primary-500',
        className,
      )}
    >
      {icon}
    </div>
  );
}

/* ---- KpiCard: o card de assinatura (raio 32px). hero=card escuro forçado ---- */
export function KpiCard({
  hero,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hero?: boolean }) {
  return (
    <div className={cn('m-card', hero && 'm-card--hero-dark', className)} {...props}>
      {children}
    </div>
  );
}

/* ---- StatusDot: ponto colorido com pulse opcional ---- */
export function StatusDot({
  tone = 'success',
  pulse,
  className,
}: {
  tone?: 'success' | 'danger' | 'warning';
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'm-dot',
        tone === 'success' && 'm-dot--success',
        tone === 'danger' && 'm-dot--danger',
        tone === 'warning' && 'm-dot--warning',
        pulse && 'm-dot--pulse',
        className,
      )}
    />
  );
}
