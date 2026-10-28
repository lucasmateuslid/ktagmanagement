import * as React from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconTile } from './primitives';

interface RecordHeaderProps {
  /** Link "← Voltar …" acima do título. */
  backLabel: string;
  onBack: () => void;
  /** Micro-label de contexto (ex.: "Ficha do veículo"). */
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Linha de badges de estado abaixo do título. */
  badges?: React.ReactNode;
  /** Ações à direita (ex.: Editar). */
  actions?: React.ReactNode;
  /** Mostra o X de fechar (usado nos formulários). */
  onClose?: () => void;
  /** Hairline abaixo do cabeçalho (formulários). */
  divider?: boolean;
  className?: string;
}

/** Cabeçalho de ficha/registro: voltar · eyebrow · título · subtítulo · badges | ações. */
export function RecordHeader({
  backLabel, onBack, eyebrow, title, subtitle, icon, badges, actions, onClose, divider, className,
}: RecordHeaderProps) {
  return (
    <header className={cn('flex items-start gap-4', divider && 'border-b border-line pb-6', className)}>
      {icon && <IconTile icon={icon} variant="accent" className="hidden sm:inline-flex" />}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 text-caption font-semibold text-fg-2 transition-colors hover:text-fg-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft size={14} aria-hidden /> {backLabel}
        </button>
        <p className="m-eyebrow m-eyebrow-accent">{eyebrow}</p>
        <h1 className="mt-2 break-words font-display text-2xl font-black uppercase tracking-tight text-fg-1 sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm font-medium uppercase text-fg-2">{subtitle}</p>}
        {badges && <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>}
      </div>
      {(actions || onClose) && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {onClose && (
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
      )}
    </header>
  );
}

interface InfoCardProps {
  title: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  /** Conteúdo à direita do título (ex.: contador). */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Card de informação das fichas (raio 24): título em caixa alta + conteúdo. */
export function InfoCard({ title, icon, description, aside, className, children }: InfoCardProps) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-fg-1">
            {icon && <span className="text-accent" aria-hidden>{icon}</span>}
            {title}
          </h2>
          {description && <p className="mt-1 text-caption text-fg-2">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Grade de pares <Detail> em duas colunas. */
export function DetailGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return <dl className={cn('grid gap-x-6 gap-y-5', cols === 2 && 'sm:grid-cols-2')}>{children}</dl>;
}
