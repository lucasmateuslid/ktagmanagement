import * as React from 'react';
import * as RxCheckbox from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Checkbox acessível (Radix). Suporta `indeterminate`.
 *
 * API mantida compatível com a versão anterior:
 *   <Checkbox checked={x} onChange={setX}>Lembrar</Checkbox>
 */
export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  id?: string;
  name?: string;
  children?: React.ReactNode;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked = false, onChange, disabled, indeterminate, id, name, children, className }, ref) => {
    const state: RxCheckbox.CheckedState = indeterminate
      ? 'indeterminate'
      : checked;

    return (
      <label
        htmlFor={id}
        className={cn(
          'group inline-flex items-center gap-2 cursor-pointer select-none',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <RxCheckbox.Root
          ref={ref}
          id={id}
          name={name}
          checked={state}
          disabled={disabled}
          onCheckedChange={(v) => {
            if (indeterminate) return;
            onChange?.(v === true);
          }}
          className={cn(
            'shrink-0 h-4 w-4 rounded border border-border-strong bg-surface-sunken',
            'inline-flex items-center justify-center transition-colors',
            'data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500',
            'data-[state=indeterminate]:bg-brand-500 data-[state=indeterminate]:border-brand-500',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
            'group-hover:border-brand-500/50',
          )}
        >
          <RxCheckbox.Indicator>
            {indeterminate ? (
              <Minus size={12} strokeWidth={3} className="text-content-inverse" />
            ) : (
              <Check size={12} strokeWidth={3} className="text-content-inverse" />
            )}
          </RxCheckbox.Indicator>
        </RxCheckbox.Root>
        {children && <span className="text-[13px] text-content">{children}</span>}
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
