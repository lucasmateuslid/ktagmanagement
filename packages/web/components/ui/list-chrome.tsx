import * as React from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

/** Cabeçalho de módulo de lista: | EYEBROW · TÍTULO · subtítulo | ações. */
export function ModuleHeader({
  eyebrow, title, subtitle, actions, className,
}: { eyebrow: string; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 m-eyebrow">
          <span aria-hidden className="m-section-head__bar !h-3.5 !w-[3px]" />
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-2xl font-black uppercase tracking-tight text-fg-1 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </header>
  );
}

/** Barra de busca em pílula (raio 24, sombra), opcionalmente fixa no topo, com ações à direita. */
export function SearchBar({
  value, onChange, placeholder, label, actions, sticky = true, className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** aria-label do campo (default = placeholder). */
  label?: string;
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-line bg-surface py-2 pl-4 pr-2 shadow-sm',
        sticky && 'sticky top-4 z-sticky',
        className,
      )}
    >
      <Search size={16} aria-hidden className="shrink-0 text-fg-3" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-fg-1 placeholder:font-medium placeholder:text-fg-3 focus:outline-none"
      />
      {actions && <div className="flex shrink-0 items-center gap-2 border-l border-line pl-2">{actions}</div>}
    </div>
  );
}

/** Rodapé de paginação: resumo à esquerda, navegação à direita. */
export function Pagination({
  summary, page, pageCount, hasNext, onPrevious, onNext, onFirst, loading,
}: {
  summary: React.ReactNode;
  /** Página atual (1-based). */
  page: number;
  /** Total de páginas, se conhecido. */
  pageCount?: number;
  /** Sobrescreve o cálculo de "há próxima" (paginação por cursor). */
  hasNext?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFirst?: () => void;
  loading?: boolean;
}) {
  const canNext = hasNext ?? (pageCount ? page < pageCount : false);
  return (
    <nav aria-label="Paginação" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-caption font-semibold text-fg-2">{summary}</p>
      <div className="flex items-center gap-2">
        {onFirst && (
          <Button type="button" variant="outline" disabled={page <= 1 || loading} onClick={onFirst}>Primeira</Button>
        )}
        <Button type="button" variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1 || loading} onClick={onPrevious}>
          <ChevronLeft size={16} aria-hidden />
        </Button>
        <span className="min-w-16 text-center text-caption font-bold text-fg-1" aria-live="polite">
          {pageCount ? `${page} de ${pageCount}` : `Página ${page}`}
        </span>
        <Button type="button" variant="outline" size="icon" aria-label="Próxima página" disabled={!canNext || loading} onClick={onNext}>
          <ChevronRight size={16} aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
