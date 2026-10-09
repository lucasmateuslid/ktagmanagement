// Executar com: firebase emulators:exec --config firebase.local.json --project demo-ktag-local --only auth,firestore 'node scripts/local-tracker-flow.mjs'
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

await import('./seed-emulators.mjs');
const db = getFirestore(initializeApp({ projectId: 'demo-ktag-local' }, 'tracker-flow'));
await db.doc('tenants/empresa-a/clients/cliente-a').update({ hasAccess: true });

const mock = { devices: [], commands: [], online: true, failWrites: false, speed: 0, fixAgeMs: 0 };
const reply = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};
const traccar = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const body = await new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
  });
  if (url.pathname === '/api/devices' && req.method === 'GET') return reply(res, 200, mock.devices.filter(device => !url.searchParams.has('uniqueId') || device.uniqueId === url.searchParams.get('uniqueId')));
  if (url.pathname === '/api/devices' && req.method === 'POST') {
    const device = { ...body, id: mock.devices.length + 1, status: 'online' };
    mock.devices.push(device);
    return reply(res, 200, device);
  }
  const deviceMatch = url.pathname.match(/^\/api\/devices\/(\d+)$/);
  if (deviceMatch) {
    const device = mock.devices.find(item => item.id === Number(deviceMatch[1]));
    if (!device) return reply(res, 404, {});
    if (req.method === 'PUT') {
      if (mock.failWrites) return reply(res, 503, {});
      Object.assign(device, body);
    }
    return reply(res, 200, { ...device, status: mock.online ? 'online' : 'offline' });
  }
  if (url.pathname === '/api/commands/types') return reply(res, 200, [{ type: 'engineStop' }, { type: 'engineResume' }]);
  if (url.pathname === '/api/commands/send') {
    mock.commands.push(body);
    return reply(res, 200, { id: mock.commands.length, ...body });
  }
  if (url.pathname === '/api/positions') {
    const position = { id: 1, deviceId: 1, valid: true, latitude: -8.05, longitude: -34.9, speed: mock.speed, fixTime: new Date(Date.now() - mock.fixAgeMs).toISOString(), serverTime: new Date().toISOString(), attributes: {} };
    return reply(res, 200, url.searchParams.has('deviceId') && Number(url.searchParams.get('deviceId')) !== 1 ? [] : [position]);
  }
  if (url.pathname === '/api/reports/route') return reply(res, 200, [{ id: 2, deviceId: 1, valid: true, latitude: -8.05, longitude: -34.9, speed: 0, fixTime: new Date(Date.now() - 30_000).toISOString(), attributes: {} }]);
  return reply(res, 404, {});
});
traccar.listen(14011, '127.0.0.1');
await once(traccar, 'listening');

const backend = spawn(process.execPath, ['--import', 'tsx', 'packages/backend/src/server.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, LOCAL_FIREBASE_EMULATORS: 'true', FIREBASE_PROJECT_ID: 'demo-ktag-local', PORT: '14010', TRACCAR_API_URL: 'http://127.0.0.1:14011/api', TRACCAR_WEB_URL: 'http://127.0.0.1:14011', TRACCAR_API_TOKEN: 'local-test', TRACCAR_REALTIME_ENABLED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let backendLogs = '';
backend.stdout.on('data', data => { backendLogs += data; });
backend.stderr.on('data', data => { backendLogs += data; });

const base = 'http://127.0.0.1:14010';
async function api(path, { token, tenant = 'empresa-a', method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'X-Tenant-Id': tenant, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); }
  catch { data = { raw: raw.slice(0, 600), backendLogs: backendLogs.slice(-2000) }; }
  return { status: response.status, data };
}
async function login(email) {
  const response = await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Local123!', returnSecureToken: true }),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result.idToken;
}
const check = async (label, expected, path, options) => {
  const result = await api(path, options);
  assert.equal(result.status, expected, `${label}: ${JSON.stringify(result.data)}\n${backendLogs.slice(-1500)}`);
  console.log(`✅ ${label}`);
  return result.data;
};

try {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await api('/api/health')).status === 200) break; } catch { /* aguardando servidor */ }
    if (attempt === 79) throw new Error(`Backend não iniciou: ${backendLogs}`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const [platform, company, client, otherCompany] = await Promise.all([
    login('superadmin@local.test'), login('admin.a@local.test'), login('cliente.a@local.test'), login('admin.b@local.test'),
  ]);
  await check('rota de rastreadores exige login', 401, '/api/trackers');
  await check('IMEI inválido retorna JSON 400', 400, '/api/trackers', { token: company, method: 'POST', body: { imei: '860000000000001', modelId: 'suntech-st340u', stockId: 'principal' } });
  const imei = '490154203237518';
  const created = await check('cadastro sem chip sincroniza Traccar', 201, '/api/trackers', { token: company, method: 'POST', body: { imei, modelId: 'suntech-st340u', stockId: 'principal' } });
  assert.equal(created.data.simCardId, undefined);
  assert.equal(created.data.integrationStatus, 'registered');
  await check('outra empresa não acessa módulo', 403, '/api/trackers', { token: otherCompany, tenant: 'empresa-b' });
  await check('empresa não libera bloqueio antes do admin', 403, `/api/trackers/${imei}/blocking`, { token: company, method: 'PATCH', body: { enabled: true } });
  await check('admin homologa perfil', 200, '/api/admin/integrations/traccar/blocking-profiles/suntech-st340u', { token: platform, tenant: 'admin', method: 'PUT', body: { approved: true, block: { type: 'engineStop' }, unblock: { type: 'engineResume' } } });
  await check('admin libera empresa', 200, '/api/admin/tenants/empresa-a/limits', { token: platform, tenant: 'admin', method: 'PATCH', body: { blockingEnabled: true } });
  await check('empresa habilita rastreador', 200, `/api/trackers/${imei}/blocking`, { token: company, method: 'PATCH', body: { enabled: true } });
  await check('empresa vincula veículo', 200, `/api/trackers/${imei}/vehicle`, { token: company, method: 'PUT', body: { vehicleId: 'veiculo-a' } });
  const map = await check('cliente vê rastreador no mapa', 200, '/api/livemap', { token: client });
  assert.ok(map.data.some(item => item.equipmentType === 'TRACKER' && item.imei === imei));
  await check('cliente consulta posição do veículo', 200, '/api/vehicles/veiculo-a/position', { token: client });
  const history = await check('cliente consulta histórico do rastreador', 200, `/api/vehicles/veiculo-a/history?from=${encodeURIComponent(new Date(Date.now() - 3_600_000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`, { token: client });
  assert.ok(history.data.points.some(point => point.provider === 'traccar' && point.tagId === `tracker:${imei}`));
  await check('cliente sem autorização não comanda', 403, '/api/blocking/vehicles/veiculo-a/commands', { token: client, method: 'POST', body: { action: 'block', confirmed: true } });
  await check('empresa autoriza cliente no veículo', 200, '/api/blocking/clients/cliente-a/vehicles/veiculo-a', { token: company, method: 'PATCH', body: { allowed: true } });
  await check('repetir vínculo não revoga autorização', 200, `/api/trackers/${imei}/vehicle`, { token: company, method: 'PUT', body: { vehicleId: 'veiculo-a' } });
  await check('cliente consulta status', 200, '/api/blocking/vehicles/veiculo-a', { token: client });
  mock.speed = 10;
  await check('bloqueio em movimento é recusado', 409, '/api/blocking/vehicles/veiculo-a/commands', { token: company, method: 'POST', body: { action: 'block', confirmed: true } });
  mock.speed = 0;
  mock.fixAgeMs = 180_000;
  await check('bloqueio com posição antiga é recusado', 409, '/api/blocking/vehicles/veiculo-a/commands', { token: company, method: 'POST', body: { action: 'block', confirmed: true } });
  mock.fixAgeMs = 0;
  await check('cliente envia bloqueio online e parado', 200, '/api/blocking/vehicles/veiculo-a/commands', { token: client, method: 'POST', body: { action: 'block', confirmed: true } });
  assert.equal(mock.commands.length, 1);
  assert.equal(mock.commands[0].attributes.noQueue, true);
  await check('bloqueio duplicado é recusado', 409, '/api/blocking/vehicles/veiculo-a/commands', { token: client, method: 'POST', body: { action: 'block', confirmed: true } });
  mock.online = false;
  await check('comando offline é recusado', 409, '/api/blocking/vehicles/veiculo-a/commands', { token: client, method: 'POST', body: { action: 'unblock', confirmed: true } });
  await check('cliente não acessa veículo de outro cliente', 404, '/api/blocking/vehicles/veiculo-b', { token: client });
  await check('admin revoga empresa', 200, '/api/admin/tenants/empresa-a/limits', { token: platform, tenant: 'admin', method: 'PATCH', body: { blockingEnabled: false } });
  await check('revogação impede cliente', 403, '/api/blocking/vehicles/veiculo-a', { token: client });
  mock.failWrites = true;
  const disabled = await check('empresa desativa bloqueio mesmo sem Traccar', 200, `/api/trackers/${imei}/blocking`, { token: company, method: 'PATCH', body: { enabled: false } });
  assert.equal(disabled.data.blockingEnabled, false);
  console.log('Fluxo local de rastreadores e bloqueio concluído.');
} finally {
  backend.kill('SIGTERM');
  await Promise.race([once(backend, 'exit'), new Promise(resolve => setTimeout(resolve, 3000))]);
  traccar.close();
}
