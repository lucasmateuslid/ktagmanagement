import * as React from 'react';
import { cn } from '../../lib/utils';

interface PageContainerProps {
  /** Largura máxima do conteúdo. Default 7xl (1280px). */
  size?: '5xl' | '6xl' | '7xl' | 'full';
  /** Inclui padding-bottom extra para acomodar a bottom-nav do client mobile. */
  withBottomNav?: boolean;
  /** Remove padding horizontal (útil para páginas full-bleed como o mapa). */
  noPaddingX?: boolean;
  className?: string;
  children: React.ReactNode;
}

const sizeMap = {
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
} as const;

/**
 * Container padronizado para páginas internas.
 * - `max-w-7xl mx-auto` por default.
 * - `px-4 sm:px-6 lg:px-8` (mobile-first).
 * - `pb-24` quando `withBottomNav` true (evita que a bottom-bar do client cubra conteúdo).
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  size = '7xl',
  withBottomNav,
  noPaddingX,
  className,
  children,
}) => (
  <div
    className={cn(
      'mx-auto w-full',
      sizeMap[size],
      !noPaddingX && 'px-4 sm:px-6 lg:px-8',
      withBottomNav ? 'pb-28 sm:pb-8' : 'pb-6 sm:pb-8',
      'pt-4 sm:pt-6',
      className,
    )}
  >
    {children}
  </div>
);

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Ícone do título. */
  icon?: React.ReactNode;
  /** Botões/ações exibidos à direita (em mobile vão pra linha de baixo). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página padronizado com título + ações que reflow em mobile.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, actions, className }) => (
  <header
    className={cn(
      'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
      'mb-6 sm:mb-8',
      className,
    )}
  >
    <div className="flex items-start gap-3 min-w-0">
      {icon && (
        <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[11px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest leading-snug">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0">
        {actions}
      </div>
    )}
  </header>
);

/**
 * Grid de stat cards padronizado. Default 1 col xs / 2 sm / 4 lg.
 * Use quando precisar de uma fileira de KPIs.
 */
export const StatsGrid: React.FC<{
  cols?: '2' | '3' | '4' | '5';
  className?: string;
  children: React.ReactNode;
}> = ({ cols = '4', className, children }) => {
  const colsMap = {
    '2': 'sm:grid-cols-2',
    '3': 'sm:grid-cols-2 lg:grid-cols-3',
    '4': 'sm:grid-cols-2 lg:grid-cols-4',
    '5': 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  } as const;
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:gap-4', colsMap[cols], className)}>
      {children}
    </div>
  );
};
