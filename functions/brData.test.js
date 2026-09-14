'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isFullyRepeatedDigits,
  isValidCNPJ,
  isValidCPF,
  isValidPhone,
  normalizePhone,
  validateCPF,
} = require('./brData');

test('valida CPF e CNPJ com ou sem máscara', () => {
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(isValidCPF('52998224724'), false);
  assert.equal(isValidCPF('529982247251'), false);
  assert.equal(isValidCNPJ('04.252.011/0001-10'), true);
  assert.equal(isValidCNPJ('04.252.011/0001-11'), false);
  assert.equal(isValidCNPJ('04.252.011/0001-100'), false);
});

test('repetição parcial não é classificada como sequência totalmente repetida', () => {
  assert.equal(isFullyRepeatedDigits('11111111111'), true);
  assert.equal(isFullyRepeatedDigits('11144477735'), false);
  assert.equal(validateCPF('11122233344').reason, 'invalid-check-digits');
});

test('normaliza telefone nacional, mascarado e com DDI', () => {
  assert.equal(normalizePhone('(84) 99999-9999'), '84999999999');
  assert.equal(normalizePhone('+55 (84) 99999-9999'), '84999999999');
  assert.equal(normalizePhone('8433334444'), '8433334444');
  assert.equal(normalizePhone('849999999999'), '849999999999');
  assert.equal(isValidPhone('849999999999'), false);
});
