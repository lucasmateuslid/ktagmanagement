import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEquipmentIdentifier, normalizeImei, normalizeMac, normalizeNumericSerial } from '@ktag/shared';
import { buildTraccarDeviceName, normalizeXadTagIdentifier, normalizeXadTagMacAddress, originalXadTagIdentifier } from './xadtag.js';

test('valida IMEI padrão sem alterar o original', () => {
  const value = '490154203237518';
  assert.equal(normalizeImei(value), value);
  assert.deepEqual(normalizeEquipmentIdentifier('imei', value), { kind: 'imei', original: value, normalized: value });
});
test('rejeita IMEI curto, longo, com letras e Luhn inválido', () => {
  assert.throws(() => normalizeImei('49015420323751'), /15 dígitos/);
  assert.throws(() => normalizeImei('4901542032375180'), /15 dígitos/);
  assert.throws(() => normalizeImei('49015420323751A'), /somente dígitos/);
  assert.throws(() => normalizeImei('490154203237519'), /Luhn/);
  assert.throws(() => normalizeImei(''), /Informe/);
});
test('normaliza MAC somente removendo separadores permitidos', () => {
  assert.equal(normalizeMac('d0-42-32-e7-e3-fa'), 'D04232E7E3FA');
  assert.equal(normalizeMac('D0:42:32:E7:E3:FA'), 'D04232E7E3FA');
  assert.equal(normalizeMac('D04232E7E3FA'), 'D04232E7E3FA');
  assert.equal(normalizeXadTagMacAddress('D0 42 32 E7 E3 FA'), 'D04232E7E3FA');
  assert.throws(() => normalizeMac('D042.32E7E3FA'), /inválidos/);
  assert.throws(() => normalizeMac('D04232'), /12 caracteres/);
});
test('normaliza serial apenas com política explícita', () => {
  assert.equal(normalizeNumericSerial('7260412520'), '7260412520');
  assert.equal(normalizeXadTagIdentifier('7260412520'), '000007260412520');
  assert.equal(normalizeXadTagIdentifier('000007260412520'), '000007260412520');
  assert.equal(originalXadTagIdentifier('000007260412520'), '7260412520');
  assert.throws(() => normalizeXadTagIdentifier('726-041-2520'), /somente dígitos/);
  assert.throws(() => normalizeXadTagIdentifier('12345678901'), /10 dígitos/);
  assert.throws(() => normalizeXadTagIdentifier('123457260412520'), /cinco zeros/);
});
test('preserva identificador original e nome patrimonial', () => {
  const result = normalizeEquipmentIdentifier('numeric_serial', '0072604125', 'xadtag_legacy_numeric_10_to_15');
  assert.equal(result.original, '0072604125');
  assert.equal(result.normalized, '000000072604125');
  assert.equal(buildTraccarDeviceName('previna', '0072604125'), 'previna+0072604125');
});
