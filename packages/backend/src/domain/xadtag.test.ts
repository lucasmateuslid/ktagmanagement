import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTraccarDeviceName, normalizeXadTagIdentifier, originalXadTagIdentifier } from './xadtag.js';

test('normaliza IMEI para exatamente 15 dígitos sem conversão numérica', () => {
  assert.equal(normalizeXadTagIdentifier('7260412520'), '000007260412520');
  assert.equal(normalizeXadTagIdentifier('000007260412520'), '000007260412520');
  assert.equal(normalizeXadTagIdentifier(' 726-041-2520 '), '000007260412520');
  assert.equal(normalizeXadTagIdentifier('0000'), '000000000000000');
  assert.equal(originalXadTagIdentifier(' 007-20 '), '00720');
});
test('rejeita identificador vazio ou maior que 15 dígitos', () => {
  assert.throws(() => normalizeXadTagIdentifier('---'), /Informe/);
  assert.throws(() => normalizeXadTagIdentifier('1234567890123456'), /15 dígitos/);
});
test('nome do device deriva do slug e IMEI original', () => {
  assert.equal(buildTraccarDeviceName('previna', '7260412520'), 'previna+7260412520');
  assert.throws(() => buildTraccarDeviceName('../tenant', '1'), /Slug/);
});
