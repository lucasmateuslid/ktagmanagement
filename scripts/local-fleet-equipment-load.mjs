import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';

const totalPerType = 1_000;
const fixedAt = new Date().toISOString();
const positions = Array.from({ length: 2 * totalPerType }, (_, index) => ({
  id: index + 1, deviceId: index + 1, latitude: -5.7 - index / 100_000,
  longitude: -35.2 - index / 100_000, valid: true, address: `Endereço do dispositivo ${index + 1}`,
  fixTime: fixedAt, serverTime: fixedAt, attributes: {},
}));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url?.startsWith('/api/positions')) response.end(JSON.stringify(positions));
  else { response.statusCode = 404; response.end('{}'); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
process.env.TRACCAR_API_URL = `http://127.0.0.1:${server.address().port}/api`;
process.env.TRACCAR_API_TOKEN = 'fleet-equipment-load';
process.env.SERVER_ADDRESS_PUBLIC_PHOTON = 'false';
const { adminDb } = await import('../packages/backend/src/services/firebaseAdmin.ts');
const { refreshTenantFleet, latestTenantFleetRefresh } = await import('../packages/backend/src/services/fleetRefreshService.ts');
const tenantId = 'fleet-equipment-load';
try {
  for (let start = 0; start < 2 * totalPerType; start += 150) {
    const batch = adminDb.batch();
    for (let index = start; index < Math.min(start + 150, 2 * totalPerType); index++) {
      const vehicleId = `v-${index}`;
      if (index < totalPerType) {
        batch.set(adminDb.doc(`tenants/${tenantId}/vehicles/${vehicleId}`), { plate: `TAG${index}`, tagId: `xad-${index}` });
        batch.set(adminDb.doc(`tenants/${tenantId}/tags/xad-${index}`), { tenantId, type: 'XADTAG', equipmentType: 'XADTAG', traccarDeviceId: index + 1 });
      } else {
        batch.set(adminDb.doc(`tenants/${tenantId}/vehicles/${vehicleId}`), { plate: `TRK${index}`, trackerId: `tracker-${index}` });
        batch.set(adminDb.doc(`tenants/${tenantId}/trackers/tracker-${index}`), { tenantId, traccarDeviceId: index + 1, vehicleId });
      }
    }
    await batch.commit();
  }
  const startedAt = Date.now();
  const report = await refreshTenantFleet(tenantId, 'manual');
  assert.equal(report.summary.totalVehicles, 2_000);
  assert.equal(report.summary.positionsUpdated, 2_000);
  assert.equal(report.summary.errors, 0);
  const loaded = await latestTenantFleetRefresh(tenantId);
  assert.equal(loaded.vehicles.length, 2_000);
  assert.equal(loaded.locations.length, 2_000);
  for (const index of [0, 500, 999, 1_000, 1_500, 1_999]) {
    const entry = loaded.vehicles.find(item => item.vehicleId === `v-${index}`);
    assert.equal(entry?.address, `Endereço do dispositivo ${index + 1}`);
    assert.equal(entry?.status, 'updated');
    assert.equal((await adminDb.doc(`tenants/${tenantId}/vehicles/v-${index}`).get()).get('lastPosition.address'), entry.address);
  }
  console.log(`✅ 1.000 XADTAGs e 1.000 rastreadores atualizados, vinculados e recuperados em ${Date.now() - startedAt} ms`);
} finally { server.close(); }
