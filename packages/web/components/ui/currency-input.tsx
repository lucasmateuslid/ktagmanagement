import * as React from 'react';
import { cn } from '../../lib/utils';

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Valor em centavos. Ex: 9990 = R$ 99,90. */
  value: number;
  onChange: (cents: number) => void;
  /** Mínimo em centavos para validação visual. */
  minCents?: number;
  /** Máximo em centavos. */
  maxCents?: number;
  /** Mostra a barra "R$" embutida no lado esquerdo. */
  showSymbol?: boolean;
  error?: string;
  className?: string;
  containerClassName?: string;
}

function centsToDisplay(cents: number): string {
  if (!cents || cents < 0) return '';
  const r = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return r;
}

function displayToCents(display: string): number {
  // Aceita "99,90", "99.90", "1.234,56", "1234.56", "1234,56", "9990"
  const digits = display.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits);
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, minCents, maxCents, showSymbol = true, error, className, containerClassName, disabled, onBlur, ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(centsToDisplay(value));
    const [focused, setFocused] = React.useState(false);

    // Sync external value -> display (quando não focado)
    React.useEffect(() => {
      if (!focused) setDisplay(centsToDisplay(value));
    }, [value, focused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const cents = displayToCents(raw);
      setDisplay(centsToDisplay(cents));
      onChange(cents);
    };

    const showError = !!error || (minCents !== undefined && value > 0 && value < minCents);
    const errorMsg = error || (minCents !== undefined && value > 0 && value < minCents
      ? `Valor mínimo: R$ ${(minCents / 100).toFixed(2).replace('.', ',')}`
      : undefined);

    return (
      <div className="w-full">
        <div
          className={cn(
            'flex w-full items-stretch overflow-hidden rounded-xl border bg-white/[0.03] transition-all',
            'border-white/5 hover:border-white/10',
            focused && 'border-amber-500/40 bg-white/[0.05]',
            showError && 'border-red-500/40',
            disabled && 'opacity-50 cursor-not-allowed',
            containerClassName,
          )}
        >
          {showSymbol && (
            <span className="flex items-center px-3 text-[11px] font-black uppercase tracking-widest text-amber-500/80 select-none border-r border-white/5">
              R$
            </span>
          )}
          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={display}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
              setFocused(false);
              if (maxCents !== undefined && value > maxCents) onChange(maxCents);
              onBlur?.(e);
            }}
            placeholder="0,00"
            className={cn(
              'flex-1 bg-transparent px-3 py-2.5 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none',
              className,
            )}
            {...props}
          />
        </div>
        {showError && errorMsg && (
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-red-400">{errorMsg}</p>
        )}
      </div>
    );
  },
);
CurrencyInput.displayName = 'CurrencyInput';
