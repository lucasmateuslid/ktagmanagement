import { CreditCard, QrCode, FileText, Banknote } from 'lucide-react';
import * as React from 'react';
import type { SelectOption } from '../components/ui/select';
import type { BillingCycle, BillingMethod } from '../types';

export const CYCLES: SelectOption<BillingCycle>[] = [
  { value: 'MONTHLY', label: 'Mensal', description: 'Cobrança todo mês' },
  { value: 'QUARTERLY', label: 'Trimestral', description: 'A cada 3 meses · ~17% desconto sugerido' },
  { value: 'YEARLY', label: 'Anual', description: 'A cada 12 meses · ~25% desconto sugerido' },
];

export const METHODS: SelectOption<BillingMethod>[] = [
  { value: 'UNDEFINED', label: 'Cliente escolhe', description: 'Asaas exibe PIX, boleto e cartão', icon: React.createElement(CreditCard, { size: 14 }) },
  { value: 'PIX', label: 'PIX', description: 'QR Code e copia-e-cola', icon: React.createElement(QrCode, { size: 14 }) },
  { value: 'BOLETO', label: 'Boleto', description: 'Bancário com código de barras', icon: React.createElement(FileText, { size: 14 }) },
  { value: 'CREDIT_CARD', label: 'Cartão', description: 'Cobrança recorrente automática', icon: React.createElement(Banknote, { size: 14 }) },
];

/** Multiplicador para converter "valor por ciclo" em "valor por mês". */
export function monthlyEquivFactor(cycle?: BillingCycle): number {
  switch (cycle) {
    case 'YEARLY': return 1 / 12;
    case 'QUARTERLY': return 1 / 3;
    case 'MONTHLY':
    default: return 1;
  }
}

export function cyclesPerYear(cycle?: BillingCycle): number {
  switch (cycle) {
    case 'YEARLY': return 1;
    case 'QUARTERLY': return 4;
    case 'MONTHLY':
    default: return 12;
  }
}
