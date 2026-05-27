import * as React from 'react';
import { cn } from '../../lib/utils';

export type TableColumn<T> = {
  key: string;
  header: React.ReactNode;
  /** Função para renderizar o valor. Se ausente, usa row[key]. */
  render?: (row: T, index: number) => React.ReactNode;
  /** Esconde a coluna abaixo de um breakpoint na visualização desktop. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Largura aproximada (ex.: "180px"). */
  width?: string;
  /** Label curto exibido na visualização card (mobile). Default usa `header`. */
  mobileLabel?: React.ReactNode;
  /** Se true, na visualização card ocupa linha inteira (não fica lado a lado). */
  mobileFullRow?: boolean;
  /** Alinhamento do cell. */
  align?: 'left' | 'center' | 'right';
};

interface ResponsiveTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  /** Estratégia mobile: 'cards' (default), 'scroll' (horizontal scroll), 'hide' (esconde colunas hideBelow). */
  mobileVariant?: 'cards' | 'scroll' | 'hide';
  /** Identificador único para chave. Default index. */
  rowKey?: (row: T, index: number) => string | number;
  /** Click handler de linha. */
  onRowClick?: (row: T, index: number) => void;
  /** Renderiza ações específicas na visualização card. */
  mobileCardActions?: (row: T, index: number) => React.ReactNode;
  /** Renderiza um título destacado no card (geralmente a primeira coluna). */
  mobileCardTitle?: (row: T, index: number) => React.ReactNode;
  /** Mensagem quando vazio. */
  emptyMessage?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const hideClass = (b?: TableColumn<any>['hideBelow']) => {
  switch (b) {
    case 'sm': return 'hidden sm:table-cell';
    case 'md': return 'hidden md:table-cell';
    case 'lg': return 'hidden lg:table-cell';
    case 'xl': return 'hidden xl:table-cell';
    default: return '';
  }
};

const alignClass = (a?: TableColumn<any>['align']) => {
  switch (a) {
    case 'center': return 'text-center';
    case 'right': return 'text-right';
    default: return 'text-left';
  }
};

/**
 * Tabela responsiva.
 * - Desktop (md+): tabela tradicional com `<table>`.
 * - Mobile (<md): vira lista de cards por linha (variant=cards) ou faz scroll horizontal (variant=scroll).
 *
 * Mantém visual do app: bg-white dark:bg-zinc-900, headers uppercase font-black tracking-widest.
 */
export function ResponsiveTable<T>({
  data,
  columns,
  mobileVariant = 'cards',
  rowKey,
  onRowClick,
  mobileCardActions,
  mobileCardTitle,
  emptyMessage = 'Nenhum registro encontrado',
  className,
  compact,
}: ResponsiveTableProps<T>) {
  const getKey = (row: T, i: number) => (rowKey ? rowKey(row, i) : i);
  const cellPad = compact ? 'px-3 py-2.5 md:px-4 md:py-3' : 'px-3 py-3.5 md:px-6 md:py-4';

  const desktop = (
    <div className={cn(
      'rounded-[24px] md:rounded-[28px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden',
      mobileVariant === 'cards' ? 'hidden md:block' : 'block',
    )}>
      <div className={cn(mobileVariant === 'scroll' && 'overflow-x-auto')}>
        <table className="w-full min-w-full">
          <thead className="bg-zinc-50/60 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400',
                    cellPad,
                    alignClass(col.align),
                    hideClass(col.hideBelow),
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={getKey(row, i)}
                  onClick={() => onRowClick?.(row, i)}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'text-sm text-zinc-700 dark:text-zinc-300',
                        cellPad,
                        alignClass(col.align),
                        hideClass(col.hideBelow),
                      )}
                    >
                      {col.render ? col.render(row, i) : String((row as any)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (mobileVariant !== 'cards') {
    return <div className={className}>{desktop}</div>;
  }

  return (
    <div className={className}>
      {desktop}
      <div className="md:hidden space-y-3">
        {data.length === 0 ? (
          <div className="rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-10 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
            {emptyMessage}
          </div>
        ) : (
          data.map((row, i) => (
            <div
              key={getKey(row, i)}
              onClick={() => onRowClick?.(row, i)}
              className={cn(
                'rounded-[20px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm',
                onRowClick && 'cursor-pointer active:scale-[0.99] transition-transform',
              )}
            >
              {mobileCardTitle && (
                <div className="mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800 font-bold text-sm text-zinc-900 dark:text-white">
                  {mobileCardTitle(row, i)}
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
                {columns.map((col) => {
                  const value = col.render ? col.render(row, i) : String((row as any)[col.key] ?? '');
                  return (
                    <div
                      key={col.key}
                      className={cn('min-w-0', col.mobileFullRow && 'col-span-2')}
                    >
                      <dt className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-0.5 truncate">
                        {col.mobileLabel ?? col.header}
                      </dt>
                      <dd className="text-xs font-medium text-zinc-700 dark:text-zinc-200 break-words">
                        {value}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {mobileCardActions && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2">
                  {mobileCardActions(row, i)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
