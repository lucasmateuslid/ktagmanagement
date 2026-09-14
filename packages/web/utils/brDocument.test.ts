import { describe, expect, it } from 'vitest';
import {
  formatCNPJ,
  formatCPF,
  formatCpfCnpj,
  formatPhone,
  isFullyRepeatedDigits,
  isValidCNPJ,
  isValidCPF,
  isValidPhone,
  normalizeCNPJ,
  normalizeCPF,
  normalizePhone,
  toBrazilianE164,
  validateCNPJ,
  validateCPF,
} from '@ktag/shared';

describe('documentos brasileiros', () => {
  it.each([
    ['529.982.247-25', '52998224725'],
    ['11144477735', '11144477735'],
    ['012.345.678-90', '01234567890'],
  ])('aceita CPF válido com ou sem máscara: %s', (input, normalized) => {
    expect(normalizeCPF(input)).toBe(normalized);
    expect(isValidCPF(input)).toBe(true);
  });

  it.each([
    ['04.252.011/0001-10', '04252011000110'],
    ['11222333000181', '11222333000181'],
    ['40.688.134/0001-61', '40688134000161'],
  ])('aceita CNPJ válido com ou sem máscara: %s', (input, normalized) => {
    expect(normalizeCNPJ(input)).toBe(normalized);
    expect(isValidCNPJ(input)).toBe(true);
  });

  it('rejeita somente repetições totais como repetição', () => {
    expect(isFullyRepeatedDigits('11111111111')).toBe(true);
    expect(isFullyRepeatedDigits('00.000.000/0000-00')).toBe(true);
    expect(isFullyRepeatedDigits('111.444.777-35')).toBe(false);
    expect(isFullyRepeatedDigits('11122233344')).toBe(false);
    expect(validateCPF('11111111111').reason).toBe('repeated');
    expect(validateCPF('11122233344').reason).toBe('invalid-check-digits');
  });

  it('não acusa documento incompleto como inválido', () => {
    expect(validateCPF('5299822472')).toMatchObject({ complete: false, valid: false, reason: 'incomplete' });
    expect(validateCNPJ('0425201100011')).toMatchObject({ complete: false, valid: false, reason: 'incomplete' });
  });

  it('valida os dígitos verificadores assim que o documento fica completo', () => {
    expect(validateCPF('52998224725')).toMatchObject({ complete: true, valid: true, reason: 'valid' });
    expect(validateCPF('52998224724')).toMatchObject({ complete: true, valid: false, reason: 'invalid-check-digits' });
    expect(validateCNPJ('04252011000110')).toMatchObject({ complete: true, valid: true, reason: 'valid' });
    expect(validateCNPJ('04252011000111')).toMatchObject({ complete: true, valid: false, reason: 'invalid-check-digits' });
    expect(validateCPF('529982247251')).toMatchObject({ complete: true, valid: false, reason: 'invalid-length' });
    expect(validateCNPJ('042520110001100')).toMatchObject({ complete: true, valid: false, reason: 'invalid-length' });
  });

  it('aplica máscaras progressivas sem duplicá-las', () => {
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
    expect(formatCPF('529.982.247-25')).toBe('529.982.247-25');
    expect(formatCNPJ('04252011000110')).toBe('04.252.011/0001-10');
    expect(formatCNPJ('04.252.011/0001-10')).toBe('04.252.011/0001-10');
    expect(formatCpfCnpj('5299822')).toBe('529.982.2');
  });
});

describe('telefones brasileiros', () => {
  it.each([
    ['84999999999', '84999999999', '(84) 99999-9999'],
    ['(84) 99999-9999', '84999999999', '(84) 99999-9999'],
    ['+55 (84) 99999-9999', '84999999999', '(84) 99999-9999'],
    ['8433334444', '8433334444', '(84) 3333-4444'],
    ['(84) 3333-4444', '8433334444', '(84) 3333-4444'],
  ])('normaliza e formata %s', (input, normalized, formatted) => {
    expect(normalizePhone(input)).toBe(normalized);
    expect(formatPhone(input)).toBe(formatted);
  });

  it('não duplica máscara e gera E.164 para integrações', () => {
    expect(formatPhone(formatPhone('84999999999'))).toBe('(84) 99999-9999');
    expect(toBrazilianE164('(84) 99999-9999')).toBe('5584999999999');
    expect(normalizePhone('849999999999')).toBe('849999999999');
    expect(isValidPhone('849999999999')).toBe(false);
  });
});
