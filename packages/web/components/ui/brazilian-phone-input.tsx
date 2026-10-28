import * as React from 'react';
import { formatPhone } from '@ktag/shared';

interface BrazilianPhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'inputMode' | 'maxLength'> {
  value?: string;
  /** Injetado por <Field error>. */
  invalid?: boolean;
  onValueChange: (formattedValue: string) => void;
}

export function BrazilianPhoneInput({ value = '', onValueChange, invalid, ...inputProps }: BrazilianPhoneInputProps) {
  return (
    <input
      {...inputProps}
      aria-invalid={invalid || undefined}
      type="tel"
      inputMode="tel"
      maxLength={20}
      value={formatPhone(value)}
      onChange={(event) => onValueChange(formatPhone(event.target.value))}
    />
  );
}
