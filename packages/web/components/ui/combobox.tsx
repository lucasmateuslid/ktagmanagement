import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface ComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Injetado por <Field error>. */
  invalid?: boolean;
  className?: string;
}

/**
 * Select pesquisável e acessível (role=combobox + listbox, setas/Enter/Esc).
 * Para listas grandes (tags, clientes); para listas curtas prefira <Select>.
 */
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nenhum resultado',
  disabled,
  invalid,
  className,
  ...aria
}: ComboboxProps & React.AriaAttributes) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id ?? 'cbx'}-list`;

  const selected = options.find((o) => o.value === value);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q))
      : options;
    return list.slice(0, 100);
  }, [options, query]);

  React.useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const commit = (opt?: ComboboxOption) => {
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(filtered[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => { setActive(0); setOpen((o) => !o); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        {...aria}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-lg border bg-surface-2 px-3 text-left text-sm text-fg-1 transition-colors',
          'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-500/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-danger' : open ? 'border-accent' : 'border-line',
        )}
      >
        <span className={cn('flex-1 truncate', !selected && 'text-fg-3')}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} aria-hidden className={cn('shrink-0 text-fg-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-dropdown mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
          <div className="relative border-b border-line">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
              aria-label={searchPlaceholder}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-fg-1 placeholder:text-fg-3 focus:outline-none"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-fg-3">{emptyText}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); commit(o); }}
                className={cn(
                  'mx-1 flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                  o.disabled && 'cursor-not-allowed opacity-40',
                  i === active ? 'bg-primary-500/10 text-accent' : 'text-fg-1',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{o.label}</div>
                  {o.description && <div className="truncate text-caption text-fg-3">{o.description}</div>}
                </div>
                {o.value === value && <Check size={13} aria-hidden className="shrink-0 text-accent" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
