// Compatibilidade para imports antigos. A implementação canônica vive no
// pacote compartilhado e é usada por todas as telas novas.
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
