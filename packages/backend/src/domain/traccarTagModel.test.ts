import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTraccarTagDeviceName, normalizeHTagIdentity, parseTraccarTagModel, traccarTagProfile } from './traccarTagModel.js';

test('H-TAG aceita somente IMEI válido de 15 dígitos', () => {
  assert.deepEqual(normalizeHTagIdentity('490154203237518'), { kind: 'imei', original: '490154203237518', normalized: '490154203237518' });
  assert.throws(() => normalizeHTagIdentity('7260412520'), /15 dígitos/);
  assert.throws(() => normalizeHTagIdentity('490154203237519'), /Luhn/);
  assert.throws(() => normalizeHTagIdentity(''), /Informe o IMEI da H-TAG/);
});
test('perfil H-TAG usa easytrack na porta 5056 e chip', () => {
  const profile = traccarTagProfile('H_TAG');
  assert.equal(profile.protocol, 'easytrack');
  assert.equal(profile.port(), 5056);
  assert.equal(profile.usesSimCard, true);
  assert.equal(profile.label, 'H-TAG');
});
test('perfil XADTAG continua GT06 e aceita serial de 10 dígitos', () => {
  const profile = traccarTagProfile(undefined);
  assert.equal(profile.model, 'XADTAG');
  assert.equal(profile.protocol, 'gt06');
  assert.equal(profile.normalizeIdentity('7260412520').normalized, '000007260412520');
});
test('rejeita modelo desconhecido', () => {
  assert.equal(parseTraccarTagModel(''), 'XADTAG');
  assert.throws(() => parseTraccarTagModel('K_TAG'), /inválido/);
});
test('nome do device H-TAG usa slug + IMEI', () => {
  assert.equal(buildTraccarTagDeviceName('H_TAG', 'acme', '490154203237518'), 'acme+490154203237518');
});
