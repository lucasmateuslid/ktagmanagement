import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { FieldValue } from 'firebase-admin/firestore';

await import('./seed-emulators.mjs');
const mock = { devices: [], position: null };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const body = await new Promise(resolve => { let raw = ''; req.on('data', chunk => { raw += chunk; }); req.on('end', () => resolve(raw ? JSON.parse(raw) : {})); });
  let status = 200; let data = null;
  if (url.pathname === '/api/devices' && req.method === 'GET') data = mock.devices.filter(device => device.uniqueId === url.searchParams.get('uniqueId'));
  else if (url.pathname === '/api/devices' && req.method === 'POST') { data = { ...body, id: mock.devices.length + 1 }; mock.devices.push(data); }
  else if (url.pathname === '/api/positions') data = mock.position && (!url.searchParams.has('deviceId') || Number(url.searchParams.get('deviceId')) === mock.position.deviceId) ? [mock.position] : [];
  else status = 404;
  res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
});
server.listen(14021, '127.0.0.1'); await once(server, 'listening');
process.env.TRACCAR_API_URL = 'http://127.0.0.1:14021/api';
process.env.TRACCAR_API_TOKEN = 'local-test';
const { adminDb } = await import('../packages/backend/src/services/firebaseAdmin.ts');
const { reconcileKtagTraccar } = await import('../packages/backend/src/services/ktagTraccarService.ts');
const { refreshSingleTagResult } = await import('../packages/backend/src/services/singleTagRefreshService.ts');
const { refreshTenantFleet } = await import('../packages/backend/src/services/fleetRefreshService.ts');
try {
  const imei = '490154203237518';
  const registration = await reconcileKtagTraccar('empresa-a', 'ktag-demo-local', imei);
  assert.deepEqual(registration, { status: 'registered', deviceId: 1 });
  assert.equal(mock.devices[0].uniqueId, imei);
  const same = await reconcileKtagTraccar('empresa-a', 'ktag-demo-local', imei);
  assert.equal(same.deviceId, 1);
  assert.equal(mock.devices.length, 1);
  console.log('✅ K-TAG registrada de forma idempotente pelo IMEI GT06');
  await adminDb.doc('tenants/empresa-b/tags/ktag-collision').set({ type: 'K_TAG', accessoryId: 'SN-B', name: 'Outra tag' });
  await assert.rejects(reconcileKtagTraccar('empresa-b', 'ktag-collision', imei), /IMEI já cadastrado/);
  console.log('✅ IMEI duplicado em outra empresa é recusado');

  const tagRef = adminDb.doc('tenants/empresa-a/tags/ktag-demo-local');
  const vehicleRef = adminDb.doc('tenants/empresa-a/vehicles/veiculo-a');
  const before = await vehicleRef.get();
  mock.position = { id: 9001, deviceId: 1, latitude: -8.06, longitude: -34.91, valid: true,
    fixTime: new Date().toISOString(), serverTime: new Date().toISOString(), address: 'Endereço do ponto novo', attributes: {} };
  const result = await refreshSingleTagResult('empresa-a', 'ktag-demo-local');
  assert.equal(result.status, 'updated'); assert.equal(result.provider, 'traccar');
  const vehicle = await vehicleRef.get();
  assert.equal(vehicle.get('lastPosition.tagId'), 'ktag-demo-local');
  assert.equal(vehicle.get('lastPosition.lat'), -8.06);
  assert.notEqual(vehicle.get('lastPosition.timestamp'), before.get('lastPosition.timestamp'));
  assert.ok((await tagRef.get()).get('communicationValidatedAt'));
  console.log('✅ posição GT06 vinculada à placa correta, sem regressão');

  const report = await refreshTenantFleet('empresa-a', 'manual');
  assert.equal(report.vehicles.find(item => item.vehicleId === 'veiculo-a')?.status, 'unchanged');
  assert.equal(report.vehicles.find(item => item.vehicleId === 'veiculo-a')?.provider, 'traccar');
  console.log('✅ worker não apresenta o mesmo pacote como atualização nova');

  mock.position = { ...mock.position, deviceId: 999, id: 9002, latitude: -9 };
  const fallback = await refreshSingleTagResult('empresa-a', 'ktag-demo-local');
  assert.equal(fallback.status, 'error');
  assert.match(fallback.error, /Traccar/);
  assert.equal((await vehicleRef.get()).get('lastPosition.lat'), -8.06);
  console.log('✅ pacote de outro dispositivo não altera a placa');

  await vehicleRef.update({ trackingLinkedAt: Date.now() + 60_000, lastPosition: FieldValue.delete() });
  mock.position = { ...mock.position, deviceId: 1, id: 9001, latitude: -8.06 };
  const oldAssignment = await refreshSingleTagResult('empresa-a', 'ktag-demo-local');
  assert.equal(oldAssignment.status, 'no_position');
  assert.equal((await vehicleRef.get()).get('lastPosition'), undefined);
  console.log('✅ posição anterior ao novo vínculo não aparece na placa');
} finally { server.close(); }
