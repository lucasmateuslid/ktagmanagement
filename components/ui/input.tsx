import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Input — primitiva de campo de texto alinhada ao "glass" do produto.
 * Estilo padrão: superfície sunken sutil, border discreta, foco brand.
 *
 * Para layouts mais ricos (label + hint + erro + ícone) use <Field/>
 * de field.tsx, que envolve este Input.
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Tamanho visual — md (default, h-10) ou lg (h-12) para forms espaçados */
  inputSize?: 'sm' | 'md' | 'lg';
  /** Mostra estado de erro (borda vermelha + anel) */
  invalid?: boolean;
}

const SIZE: Record<NonNullable<InputProps['inputSize']>, string> = {
  sm: 'h-9  text-sm  rounded-lg px-3',
  md: 'h-10 text-sm  rounded-xl px-3.5',
  lg: 'h-12 text-base rounded-xl px-4',
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputSize = 'md', invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full bg-surface-sunken border border-border text-content',
          'placeholder:text-content-subtle caret-brand-500',
          'transition-colors',
          'focus-visible:outline-none focus-visible:border-brand-500/60 focus-visible:bg-surface-raised focus-visible:ring-2 focus-visible:ring-brand-500/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid && 'border-danger/60 focus-visible:border-danger focus-visible:ring-danger/20',
          SIZE[inputSize],
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
