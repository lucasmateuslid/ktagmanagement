import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TabItem<K extends string = string> {
  key: K;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps<K extends string = string> {
  tabs: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}

export function Tabs<K extends string = string>({ tabs, value, onChange, className }: TabsProps<K>) {
  const active = tabs.find((t) => t.key === value) ?? tabs[0];

  return (
    <div className={className}>
      <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.key === active?.key;
          return (
            <button
              key={tab.key}
              type="button"
              disabled={tab.disabled}
              onClick={() => onChange(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200',
                tab.disabled && 'opacity-40 cursor-not-allowed',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="pt-4">{active?.content}</div>
    </div>
  );
}
