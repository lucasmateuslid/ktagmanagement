// Compatibilidade com a árvore legada: a implementação canônica vive em @ktag/shared.
export {
  documentDigits,
  formatCNPJ,
  formatCPF,
  formatCpfCnpj,
  formatPhone,
  isFullyRepeatedDigits,
  isValidCNPJ,
  isValidCPF,
  isValidCpfCnpj,
  isValidPhone,
  normalizeCNPJ,
  normalizeCPF,
  normalizeDigits,
  normalizePhone,
  toBrazilianE164,
  validateCNPJ,
  validateCPF,
  validateCpfCnpj,
} from '@ktag/shared';

export type {
  BrazilianDocumentType,
  BrazilianDocumentValidation,
  BrazilianDocumentValidationReason,
} from '@ktag/shared';
