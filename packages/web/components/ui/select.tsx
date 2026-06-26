import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SelectProps<V extends string = string> {
  value: V | undefined;
  onChange: (value: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  id?: string;
  name?: string;
  /** Largura do dropdown — por padrão acompanha o trigger. */
  menuWidth?: 'trigger' | number;
  /** Renderiza um ícone à esquerda do valor selecionado. */
  leftIcon?: React.ReactNode;
}

interface MenuRect {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
}

export function Select<V extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Selecione…',
  disabled,
  error,
  className,
  id,
  name,
  menuWidth = 'trigger',
  leftIcon,
}: SelectProps<V>) {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const [rect, setRect] = React.useState<MenuRect | null>(null);
  const typeBufferRef = React.useRef<{ text: string; resetAt: number }>({ text: '', resetAt: 0 });

  const selected = options.find(o => o.value === value);

  const computeRect = React.useCallback((): MenuRect | null => {
    const el = triggerRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const desiredHeight = Math.min(options.length * 44 + 16, 320);
    const openUpward = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    return {
      top: openUpward ? r.top - 8 : r.bottom + 8,
      left: r.left,
      width: typeof menuWidth === 'number' ? menuWidth : r.width,
      openUpward,
    };
  }, [menuWidth, options.length]);

  const openMenu = () => {
    if (disabled) return;
    const next = computeRect();
    setRect(next);
    setOpen(true);
    const idx = Math.max(0, options.findIndex(o => o.value === value));
    setActiveIndex(idx);
  };

  const closeMenu = React.useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onResize = () => setRect(computeRect());
    const onScroll = () => setRect(computeRect());
    const onDocClick = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open, computeRect]);

  const commitIndex = (i: number) => {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    closeMenu();
  };

  const moveActive = (dir: 1 | -1) => {
    const n = options.length;
    if (n === 0) return;
    let i = activeIndex;
    for (let step = 0; step < n; step++) {
      i = (i + dir + n) % n;
      if (!options[i].disabled) break;
    }
    setActiveIndex(i);
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) openMenu();
      else moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) openMenu();
      else moveActive(-1);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      closeMenu();
    } else if (open && /^[a-z0-9]$/i.test(e.key)) {
      // Type-ahead
      const now = Date.now();
      const buf = typeBufferRef.current;
      const text = now - buf.resetAt > 700 ? e.key.toLowerCase() : buf.text + e.key.toLowerCase();
      typeBufferRef.current = { text, resetAt: now };
      const i = options.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(text));
      if (i >= 0) setActiveIndex(i);
    } else if (open && e.key === 'Enter') {
      e.preventDefault();
      commitIndex(activeIndex);
    }
  };

  // Scroll active option into view
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    const list = menuRef.current?.querySelector('[role="listbox"]');
    const item = list?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const triggerClasses = cn(
    'group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all',
    'bg-white/[0.03] border border-white/5 hover:border-white/10',
    'focus:outline-none focus-visible:border-amber-500/40 focus-visible:bg-white/[0.05]',
    open && 'border-amber-500/40 bg-white/[0.05]',
    disabled && 'opacity-50 cursor-not-allowed',
    error && 'border-red-500/40 focus-visible:border-red-500/60',
    className,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={!!error || undefined}
        className={triggerClasses}
      >
        {leftIcon && <span className="shrink-0 text-zinc-400">{leftIcon}</span>}
        {selected?.icon && <span className="shrink-0 text-zinc-400">{selected.icon}</span>}
        <span className={cn('flex-1 truncate', !selected && 'text-zinc-500')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-zinc-500 transition-transform', open && 'rotate-180 text-amber-400')}
        />
      </button>
      {error && (
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-red-400">{error}</p>
      )}

      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.div
              ref={menuRef}
              role="presentation"
              initial={{ opacity: 0, y: rect.openUpward ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: rect.openUpward ? 6 : -6, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                top: rect.openUpward ? undefined : rect.top,
                bottom: rect.openUpward ? window.innerHeight - rect.top : undefined,
                left: rect.left,
                width: rect.width,
                zIndex: 4300, /* z-popover — acima de modais (z-modal=4100) p/ não sumir atrás deles */
              }}
              className="rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden"
            >
              <ul
                role="listbox"
                aria-activedescendant={activeIndex >= 0 ? `${id || 'select'}-opt-${activeIndex}` : undefined}
                className="max-h-80 overflow-y-auto py-1.5"
              >
                {options.length === 0 && (
                  <li className="px-3 py-2 text-xs text-zinc-500 uppercase tracking-widest">Sem opções</li>
                )}
                {options.map((opt, i) => {
                  const isSelected = opt.value === value;
                  const isActive = i === activeIndex;
                  return (
                    <li
                      key={opt.value}
                      id={`${id || 'select'}-opt-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseDown={(e) => { e.preventDefault(); commitIndex(i); }}
                      className={cn(
                        'mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        opt.disabled && 'opacity-40 cursor-not-allowed',
                        !opt.disabled && isActive && 'bg-amber-500/10 text-amber-300',
                        !opt.disabled && !isActive && 'text-zinc-200 hover:bg-white/[0.04]',
                        isSelected && !isActive && 'text-amber-400',
                      )}
                    >
                      {opt.icon && <span className="shrink-0 opacity-70">{opt.icon}</span>}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{opt.label}</div>
                        {opt.description && (
                          <div className="text-[10px] text-zinc-500 truncate">{opt.description}</div>
                        )}
                      </div>
                      {isSelected && <Check size={13} className="shrink-0 text-amber-400" />}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
