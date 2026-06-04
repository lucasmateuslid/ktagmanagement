import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Button — primitiva alinhada ao estilo real do K-TAG (pill âmbar + variantes).
 *
 * Variantes refletem padrões observados na base:
 *   - primary:   `bg-brand-500 text-content-inverse` (pill principal de CTA)
 *   - secondary: superfície sunken neutra
 *   - ghost:     transparente, hover sunken
 *   - outline:   só borda
 *   - danger:    estado destrutivo
 *   - link:      texto sublinhado
 *
 * Tamanhos cobrem h-9/h-10/h-12/h-14 (os 4 alvos observados em forms reais).
 * `loading` desativa o botão e troca o conteúdo por spinner.
 * `iconLeft` / `iconRight` aceitam ReactNode (use ícones Lucide).
 */
export const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-black uppercase tracking-widest',
    'transition-all active:scale-[0.97]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:pointer-events-none disabled:opacity-50',
  ),
  {
    variants: {
      variant: {
        primary:
          'bg-brand-500 text-content-inverse hover:bg-brand-400 shadow-lg shadow-brand-500/20',
        secondary:
          'bg-surface-sunken text-content hover:bg-surface-overlay border border-border',
        ghost:
          'bg-transparent text-content-soft hover:bg-surface-sunken hover:text-content',
        outline:
          'bg-transparent text-content border border-border-strong hover:bg-surface-sunken',
        danger:
          'bg-danger text-white hover:brightness-110 shadow-lg shadow-danger/20',
        link:
          'bg-transparent text-brand-500 hover:text-brand-400 underline-offset-4 hover:underline shadow-none',
      },
      size: {
        xs: 'h-8  px-3  text-[10px] rounded-lg',
        sm: 'h-9  px-3.5 text-[10px] rounded-lg',
        md: 'h-10 px-4   text-[11px] rounded-xl',
        lg: 'h-12 px-5   text-xs    rounded-xl',
        xl: 'h-14 px-7   text-sm    rounded-xl',
        icon: 'h-10 w-10 rounded-xl',
      },
      pill: {
        true: 'rounded-pill',
        false: '',
      },
      full: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      pill: false,
      full: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza como filho via Radix Slot (ex: <Button asChild><Link/></Button>). */
  asChild?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      pill,
      full,
      asChild = false,
      loading = false,
      disabled,
      iconLeft,
      iconRight,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const content = (
      <>
        {loading ? (
          <Loader2 className="animate-spin" size={size === 'xl' ? 18 : 14} aria-hidden />
        ) : (
          iconLeft && <span className="shrink-0 inline-flex">{iconLeft}</span>
        )}
        {children && <span className="inline-flex items-center">{children}</span>}
        {!loading && iconRight && <span className="shrink-0 inline-flex">{iconRight}</span>}
      </>
    );

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, pill, full }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (children as React.ReactElement) : content}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button };
