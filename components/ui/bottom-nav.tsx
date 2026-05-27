import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface BaseItem {
  label: string;
  icon: React.ReactNode;
}

interface LinkItem extends BaseItem {
  to: string;
  end?: boolean;
  onClick?: never;
  active?: never;
}

interface ActionItem extends BaseItem {
  onClick: () => void;
  active?: boolean;
  to?: never;
  end?: never;
}

export type BottomNavItem = LinkItem | ActionItem;

interface BottomNavProps {
  items: BottomNavItem[];
  className?: string;
}

/**
 * Navegação inferior estilo app mobile, visível apenas em telas pequenas.
 * Aceita items NavLink (`to`) ou de ação (`onClick`). Inclui safe-area-inset.
 */
export function BottomNav({ items, className }: BottomNavProps) {
  const cols: Record<number, string> = {
    1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5',
  };
  return (
    <nav
      className={cn(
        'md:hidden fixed inset-x-0 bottom-0 z-40',
        'border-t border-white/5 bg-zinc-950/90 backdrop-blur-xl',
        'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
      aria-label="Navegação principal"
    >
      <ul className={cn('grid', cols[items.length] || 'grid-cols-5')}>
        {items.map((item, i) =>
          'to' in item && item.to !== undefined ? (
            <LinkBottomItem key={`${item.to}-${i}`} item={item} />
          ) : (
            <ActionBottomItem key={`act-${item.label}-${i}`} item={item as ActionItem} />
          ),
        )}
      </ul>
    </nav>
  );
}

const LinkBottomItem = ({ item }: { item: LinkItem }) => (
  <li>
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group relative flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors',
          isActive ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-200',
        )
      }
    >
      {({ isActive }) => <Inner active={isActive} label={item.label} icon={item.icon} />}
    </NavLink>
  </li>
);

const ActionBottomItem = ({ item }: { item: ActionItem }) => (
  <li>
    <button
      type="button"
      onClick={item.onClick}
      className={cn(
        'group relative w-full flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors',
        item.active ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-200',
      )}
    >
      <Inner active={!!item.active} label={item.label} icon={item.icon} />
    </button>
  </li>
);

const Inner = ({ active, label, icon }: { active: boolean; label: string; icon: React.ReactNode }) => (
  <>
    {active && (
      <motion.span
        layoutId="bottom-nav-active"
        className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      />
    )}
    <span className={cn('transition-transform', active && 'scale-110')}>{icon}</span>
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </>
);
