import * as React from 'react';
import {
  formatCNPJ,
  formatCPF,
  formatCpfCnpj,
  validateCNPJ,
  validateCPF,
  validateCpfCnpj,
  type BrazilianDocumentValidation,
} from '@ktag/shared';

type DocumentKind = 'cpf' | 'cnpj' | 'cpf-cnpj';

interface BrazilianDocumentInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'inputMode' | 'maxLength'> {
  kind: DocumentKind;
  /** Injetado por <Field error>. */
  invalid?: boolean;
  value?: string;
  onValueChange: (formattedValue: string, validation: BrazilianDocumentValidation) => void;
}

function validationMessage(validation: BrazilianDocumentValidation): string | null {
  if (!validation.complete || validation.valid) return null;
  const label = validation.type === 'cpf' ? 'CPF' : 'CNPJ';
  if (validation.reason === 'repeated') return `${label} não pode ter todos os dígitos iguais.`;
  return `${label} inválido. Verifique os dígitos informados.`;
}

export function BrazilianDocumentInput({
  kind,
  value = '',
  onValueChange,
  className,
  id,
  invalid,
  ...inputProps
}: BrazilianDocumentInputProps) {
  const validation = kind === 'cpf'
    ? validateCPF(value)
    : kind === 'cnpj'
      ? validateCNPJ(value)
      : validateCpfCnpj(value);
  const formattedValue = kind === 'cpf'
    ? formatCPF(value)
    : kind === 'cnpj'
      ? formatCNPJ(value)
      : formatCpfCnpj(value);
  const error = validationMessage(validation);
  const errorId = id ? `${id}-error` : undefined;

  return (
    <>
      <input
        {...inputProps}
        id={id}
        type="text"
        inputMode="numeric"
        maxLength={kind === 'cpf' ? 14 : 18}
        value={formattedValue}
        onChange={(event) => {
          const formatted = kind === 'cpf'
            ? formatCPF(event.target.value)
            : kind === 'cnpj'
              ? formatCNPJ(event.target.value)
              : formatCpfCnpj(event.target.value);
          const nextValidation = kind === 'cpf'
            ? validateCPF(formatted)
            : kind === 'cnpj'
              ? validateCNPJ(formatted)
              : validateCpfCnpj(formatted);
          onValueChange(formatted, nextValidation);
        }}
        aria-invalid={error || invalid ? true : undefined}
        aria-describedby={error ? errorId : inputProps['aria-describedby']}
        className={`${className ?? ''} ${error ? 'border-danger' : ''}`.trim()}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-caption font-bold text-danger">
          {error}
        </p>
      )}
    </>
  );
}
