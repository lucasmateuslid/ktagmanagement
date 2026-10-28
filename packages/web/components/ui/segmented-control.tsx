import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: string;
  /** Classes aplicadas quando selecionado (ex.: bg-success text-white). */
  activeClassName?: string;
}

interface SegmentedControlProps<V extends string = string> {
  value: V | undefined;
  onChange: (value: V) => void;
  options: SegmentedOption<V>[];
  'aria-label': string;
  className?: string;
}

/** Alternância exclusiva (radiogroup) para 2–4 opções curtas. Alvos de 40px. */
export function SegmentedControl<V extends string = string>({
  value,
  onChange,
  options,
  className,
  ...aria
}: SegmentedControlProps<V>) {
  return (
    <div role="radiogroup" aria-label={aria['aria-label']} className={cn('flex gap-1 rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-10 flex-1 rounded-lg px-2 text-2xs font-black uppercase tracking-widest transition-colors active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              active ? (option.activeClassName ?? 'bg-accent text-fg-on-accent shadow-sm') : 'text-fg-2 hover:text-fg-1',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
