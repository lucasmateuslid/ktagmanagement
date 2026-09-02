import assert from 'node:assert/strict';
import test from 'node:test';
import { clientFleetVehicleDto } from './client.js';
import { encryptTenantValue } from '../services/vehicleSearch.js';

test('client fleet returns a decrypted vehicle plate', () => {
  const tenantId = 'tenant-client-fleet';
  const encryptedPlate = encryptTenantValue(tenantId, 'ABC1D23');

  const vehicle = clientFleetVehicleDto(tenantId, 'vehicle-1', {
    plate: encryptedPlate,
    model: 'Onix',
    clientId: 'client-1',
  });

  assert.equal(vehicle.plate, 'ABC1D23');
  assert.notEqual(vehicle.plate, encryptedPlate);
});

test('client fleet remains compatible with legacy plaintext plates', () => {
  const vehicle = clientFleetVehicleDto('tenant-client-fleet', 'vehicle-1', {
    plate: 'XYZ9A87',
  });

  assert.equal(vehicle.plate, 'XYZ9A87');
});
