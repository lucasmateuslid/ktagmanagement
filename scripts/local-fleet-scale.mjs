import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';

let position = {
  id: 101, deviceId: 71, latitude: -5.742603, longitude: -35.266183,
  valid: true, address: 'Rua da posição A, Natal', fixTime: new Date().toISOString(),
  serverTime: new Date().toISOString(), attributes: {},
};
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url?.startsWith('/api/positions')) response.end(JSON.stringify([position]));
  else { response.statusCode = 404; response.end('{}'); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;
process.env.TRACCAR_API_URL = `http://127.0.0.1:${port}/api`;
process.env.TRACCAR_API_TOKEN = 'fleet-scale-test';
process.env.SERVER_ADDRESS_PUBLIC_PHOTON = 'false';

const { adminDb } = await import('../packages/backend/src/services/firebaseAdmin.ts');
const { refreshTenantFleet, latestTenantFleetRefresh } = await import('../packages/backend/src/services/fleetRefreshService.ts');
const tenantId = 'fleet-scale-test';
const vehiclesRef = adminDb.collection(`tenants/${tenantId}/vehicles`);
const tagsRef = adminDb.collection(`tenants/${tenantId}/tags`);
try {
  for (let start = 0; start < 2_001; start += 400) {
    const batch = adminDb.batch();
    for (let index = start; index < Math.min(start + 400, 2_001); index++) {
      const id = `vehicle-${String(index).padStart(4, '0')}`;
      batch.set(vehiclesRef.doc(id), { plate: `TST${String(index).padStart(4, '0')}`, model: 'Teste de escala',
        ...(index === 0 ? { tagId: 'xad-1' } : {}) });
    }
    await batch.commit();
  }
  await tagsRef.doc('xad-1').set({ tenantId, type: 'XADTAG', equipmentType: 'XADTAG', traccarDeviceId: 71 });
  const first = await refreshTenantFleet(tenantId, 'manual');
  assert.equal(first.summary.totalVehicles, 2_001);
  assert.equal(first.vehicles.find(item => item.vehicleId === 'vehicle-0000')?.address, 'Rua da posição A, Natal');
  const loaded = await latestTenantFleetRefresh(tenantId);
  assert.equal(loaded.vehicles.length, 2_001);
  assert.equal(loaded.vehicles.find(item => item.vehicleId === 'vehicle-0000')?.address, 'Rua da posição A, Natal');
  console.log('✅ 2.001 veículos: relatório dividido e lido integralmente; endereço Traccar ligado à placa correta');

  position = { ...position, id: 102, latitude: -5.76, longitude: -35.28, address: null,
    fixTime: new Date(Date.now() + 1_000).toISOString(), serverTime: new Date().toISOString() };
  const moved = await refreshTenantFleet(tenantId, 'manual');
  const movedVehicle = moved.vehicles.find(item => item.vehicleId === 'vehicle-0000');
  assert.equal(movedVehicle?.address, null);
  assert.equal(moved.locations.find(item => item.tagId === 'xad-1')?.lat, -5.76);
  console.log('✅ nova coordenada sem endereço não herda endereço da posição anterior');

  const batch = adminDb.batch();
  batch.set(tagsRef.doc('xad-2'), { tenantId, type: 'XADTAG', equipmentType: 'XADTAG', traccarDeviceId: 71 });
  batch.update(vehiclesRef.doc('vehicle-0001'), { tagId: 'xad-2' });
  await batch.commit();
  const duplicate = await refreshTenantFleet(tenantId, 'manual');
  assert.equal(duplicate.vehicles.find(item => item.vehicleId === 'vehicle-0000')?.status, 'error');
  assert.equal(duplicate.vehicles.find(item => item.vehicleId === 'vehicle-0001')?.status, 'error');
  assert.equal((await vehiclesRef.doc('vehicle-0001').get()).get('lastPosition'), undefined);
  console.log('✅ deviceId duplicado não atribui a posição à placa de outro equipamento');
} finally {
  server.close();
}
