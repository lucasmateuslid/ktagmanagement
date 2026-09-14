import * as React from 'react';
import { formatPhone } from '@ktag/shared';

interface BrazilianPhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'inputMode' | 'maxLength'> {
  value?: string;
  onValueChange: (formattedValue: string) => void;
}

export function BrazilianPhoneInput({ value = '', onValueChange, ...inputProps }: BrazilianPhoneInputProps) {
  return (
    <input
      {...inputProps}
      type="tel"
      inputMode="tel"
      maxLength={20}
      value={formatPhone(value)}
      onChange={(event) => onValueChange(formatPhone(event.target.value))}
    />
  );
}
