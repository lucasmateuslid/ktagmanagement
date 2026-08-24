import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTrackerImei, normalizeTrackerImei } from './tracker.js';

test('não remove caracteres inválidos do IMEI', () => {
  assert.throws(() => normalizeTrackerImei('49015-4203237518'), /somente dígitos/);
});
test('aceita somente IMEI de 15 dígitos com Luhn', () => {
  assert.equal(normalizeTrackerImei('490154203237518'), '490154203237518');
  assert.equal(isValidTrackerImei('490154203237518'), true);
  assert.equal(isValidTrackerImei('490154203237519'), false);
  assert.equal(isValidTrackerImei('49015420323751'), false);
  assert.equal(isValidTrackerImei(''), false);
});
