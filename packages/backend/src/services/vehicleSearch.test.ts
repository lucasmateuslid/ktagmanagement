import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVehicleSearchNgrams, decryptTenantValue, encryptTenantValue,
  normalizeVehicleSearch, vehicleSearchCandidateToken,
} from './vehicleSearch.js';

test('normalizes accents, punctuation and casing', () => {
  assert.equal(normalizeVehicleSearch('  João-Silva  '), 'JOAOSILVA');
});

test('indexes substrings in any position with one to three characters', () => {
  const tokens = buildVehicleSearchNgrams('tenant-a', ['ABC1D23']);
  assert.ok(tokens.includes(vehicleSearchCandidateToken('tenant-a', '1D2')!));
  assert.ok(tokens.includes(vehicleSearchCandidateToken('tenant-a', 'D23')!));
  assert.ok(tokens.includes(vehicleSearchCandidateToken('tenant-a', '2')!));
});

test('uses a candidate trigram while authoritative matching keeps the full term', () => {
  assert.equal(vehicleSearchCandidateToken('tenant-a', 'silva'), vehicleSearchCandidateToken('tenant-a', 'sil'));
});

test('encrypts and decrypts with tenant isolation', () => {
  const encrypted = encryptTenantValue('tenant-a', 'ABC1D23');
  assert.equal(decryptTenantValue('tenant-a', encrypted), 'ABC1D23');
  assert.equal(decryptTenantValue('tenant-b', encrypted), encrypted);
});
