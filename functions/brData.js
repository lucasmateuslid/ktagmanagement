'use strict';

function normalizeDigits(value, maxLength) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return maxLength === undefined ? digits : digits.slice(0, maxLength);
}

const normalizeCPF = (value) => normalizeDigits(value);
const normalizeCNPJ = (value) => normalizeDigits(value);

function isFullyRepeatedDigits(value) {
  const digits = normalizeDigits(value);
  return digits.length > 1 && /^(\d)\1+$/.test(digits);
}

function validateCPF(value) {
  const cpf = normalizeCPF(value);
  if (!cpf) return { type: 'cpf', digits: cpf, complete: false, valid: false, reason: 'empty' };
  if (cpf.length < 11) return { type: 'cpf', digits: cpf, complete: false, valid: false, reason: 'incomplete' };
  if (cpf.length > 11) return { type: 'cpf', digits: cpf, complete: true, valid: false, reason: 'invalid-length' };
  if (isFullyRepeatedDigits(cpf)) return { type: 'cpf', digits: cpf, complete: true, valid: false, reason: 'repeated' };
  for (let size = 9; size <= 10; size += 1) {
    let sum = 0;
    for (let index = 0; index < size; index += 1) sum += Number(cpf[index]) * (size + 1 - index);
    if ((((sum * 10) % 11) % 10) !== Number(cpf[size])) {
      return { type: 'cpf', digits: cpf, complete: true, valid: false, reason: 'invalid-check-digits' };
    }
  }
  return { type: 'cpf', digits: cpf, complete: true, valid: true, reason: 'valid' };
}

function validateCNPJ(value) {
  const cnpj = normalizeCNPJ(value);
  if (!cnpj) return { type: 'cnpj', digits: cnpj, complete: false, valid: false, reason: 'empty' };
  if (cnpj.length < 14) return { type: 'cnpj', digits: cnpj, complete: false, valid: false, reason: 'incomplete' };
  if (cnpj.length > 14) return { type: 'cnpj', digits: cnpj, complete: true, valid: false, reason: 'invalid-length' };
  if (isFullyRepeatedDigits(cnpj)) return { type: 'cnpj', digits: cnpj, complete: true, valid: false, reason: 'repeated' };
  const calculate = (length) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = weights.reduce((sum, weight, index) => sum + Number(cnpj[index]) * weight, 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const valid = calculate(12) === Number(cnpj[12]) && calculate(13) === Number(cnpj[13]);
  return { type: 'cnpj', digits: cnpj, complete: true, valid, reason: valid ? 'valid' : 'invalid-check-digits' };
}

function isValidCPF(value) { return validateCPF(value).valid; }
function isValidCNPJ(value) { return validateCNPJ(value).valid; }
function isValidCpfCnpj(value) {
  const digits = normalizeDigits(value);
  return digits.length === 11 ? isValidCPF(digits) : digits.length === 14 ? isValidCNPJ(digits) : false;
}

function normalizePhone(value) {
  const raw = String(value ?? '');
  let digits = normalizeDigits(raw);
  const explicitlyInternational = /^\s*\+\s*55(?:\D|$)/.test(raw);
  if (digits.startsWith('55') && (explicitlyInternational || digits.length > 11)) digits = digits.slice(2);
  return digits;
}

function isValidPhone(value) {
  const length = normalizePhone(value).length;
  return length === 10 || length === 11;
}

module.exports = {
  isFullyRepeatedDigits,
  isValidCNPJ,
  isValidCPF,
  isValidCpfCnpj,
  isValidPhone,
  normalizeCNPJ,
  normalizeCPF,
  normalizeDigits,
  normalizePhone,
  validateCNPJ,
  validateCPF,
};
