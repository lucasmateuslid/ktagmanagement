import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Injetado por <Field error>. */
  invalid?: boolean;
}

/** Campo de texto longo do DS (observações). */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-28 w-full resize-y rounded-lg border bg-surface-2 px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-3 transition-colors',
        'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-primary-500/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger' : 'border-line',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
