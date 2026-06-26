import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Field — wrapper de formulário que padroniza label + control + hint/error.
 *
 * Uso típico:
 *   <Field label="E-mail" hint="Será usado para login" error={err}>
 *     <Input type="email" value={...} onChange={...} />
 *   </Field>
 *
 * O label tem `htmlFor` ligado ao id do filho (se houver). Hint/erro
 * recebem `aria-describedby` automático.
 */
export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** id do campo — se omitido, gerado. Aplicado ao primeiro filho via cloneElement. */
  htmlFor?: string;
  className?: string;
  children: React.ReactElement;
}

let _fieldCounter = 0;
const nextFieldId = () => `fld-${++_fieldCounter}`;

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useMemo(() => nextFieldId(), []);
  const id = htmlFor ?? (children.props as any).id ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-err` : undefined;

  const describedBy =
    [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const child = React.cloneElement(children, {
    id,
    'aria-describedby': describedBy,
    'aria-required': required || undefined,
    invalid: !!error,
  } as any);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-label-xs text-content-muted uppercase select-none"
        >
          {label}
          {required && <span className="text-danger ml-1" aria-hidden>*</span>}
        </label>
      )}
      {child}
      {error ? (
        <p id={errorId} role="alert" className="text-[11px] font-bold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[11px] text-content-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
