import assert from 'node:assert/strict';
import test from 'node:test';
import { splitFleetReport, type FleetRefreshReport } from './fleetRefreshService.js';

test('splits thousands of vehicle outcomes and map positions into bounded Firestore parts', () => {
  const report: FleetRefreshReport = {
    id: 'run', tenantId: 'tenant', trigger: 'worker', startedAt: 1, completedAt: 2, busy: false,
    summary: { totalVehicles: 5_001, linkedVehicles: 5_001, positionsUpdated: 5_001, addressesResolved: 0, addressesReused: 0, addressesFailed: 0, withoutPosition: 0, errors: 0 },
    vehicles: Array.from({ length: 5_001 }, (_, index) => ({ vehicleId: String(index), plate: `ABC${index}`, model: '', tagId: String(index), tagIdentifier: String(index), provider: 'traccar' as const, status: 'updated' as const, address: null, timestamp: 1, ageMinutes: 0, attemptedAt: 1 })),
    locations: Array.from({ length: 5_001 }, (_, index) => ({ tagId: String(index), lat: -5.7, lon: -35.2, timestamp: 1 })),
  };
  const parts = splitFleetReport(report);
  assert.equal(parts.length, 51);
  assert.ok(parts.every(part => part.vehicles.length <= 100 && part.locations.length <= 100));
  assert.deepEqual(parts.flatMap(part => part.vehicles), report.vehicles);
  assert.deepEqual(parts.flatMap(part => part.locations), report.locations);
});
