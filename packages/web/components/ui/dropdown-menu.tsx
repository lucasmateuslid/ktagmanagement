import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface DropdownItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
  description?: string;
  loading?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactElement;
  items: DropdownItem[];
  align?: 'start' | 'end';
  /** Largura mínima do menu em px. */
  minWidth?: number;
}

interface MenuRect {
  top: number;
  left: number;
  openUpward: boolean;
}

export function DropdownMenu({ trigger, items, align = 'end', minWidth = 200 }: DropdownMenuProps) {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<MenuRect | null>(null);
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);

  const computeRect = React.useCallback((): MenuRect | null => {
    const el = triggerRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const menuHeight = Math.min(items.length * 44 + 16, 320);
    const spaceBelow = window.innerHeight - r.bottom;
    const openUpward = spaceBelow < menuHeight + 24;
    const top = openUpward ? r.top - 6 : r.bottom + 6;
    const left = align === 'end' ? r.right - minWidth : r.left;
    return { top, left: Math.max(8, left), openUpward };
  }, [align, items.length, minWidth]);

  const close = React.useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onScroll = () => setRect(computeRect());
    const onDocClick = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        const it = items[activeIndex];
        if (it && !it.disabled) { it.onSelect(); close(); }
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, activeIndex, items, close, computeRect]);

  const triggerWithProps = React.cloneElement(trigger as React.ReactElement<any>, {
    ref: (node: HTMLElement) => {
      triggerRef.current = node;
      const r = (trigger as any).ref;
      if (typeof r === 'function') r(node);
      else if (r && typeof r === 'object') r.current = node;
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (open) close();
      else {
        setRect(computeRect());
        setOpen(true);
      }
      (trigger.props as any).onClick?.(e);
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  });

  return (
    <>
      {triggerWithProps}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, y: rect.openUpward ? 4 : -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: rect.openUpward ? 4 : -4, scale: 0.97 }}
              transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                top: rect.openUpward ? undefined : rect.top,
                bottom: rect.openUpward ? window.innerHeight - rect.top : undefined,
                left: rect.left,
                minWidth,
                zIndex: 100,
              }}
              className="rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden py-1.5"
            >
              {items.map((it, i) => (
                <button
                  key={it.key}
                  role="menuitem"
                  type="button"
                  disabled={it.disabled || it.loading}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (it.disabled || it.loading) return;
                    it.onSelect();
                    close();
                  }}
                  className={cn(
                    'group w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    activeIndex === i && !it.destructive && 'bg-amber-500/10 text-amber-300',
                    activeIndex === i && it.destructive && 'bg-red-500/10 text-red-300',
                    activeIndex !== i && it.destructive && 'text-red-400 hover:bg-red-500/10',
                    activeIndex !== i && !it.destructive && 'text-zinc-200 hover:bg-white/[0.04]',
                  )}
                >
                  {it.icon && (
                    <span className={cn('shrink-0', it.loading && 'animate-spin')}>
                      {it.icon}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.label}</div>
                    {it.description && (
                      <div className="text-[10px] text-zinc-500 truncate mt-0.5">{it.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
