import assert from 'node:assert/strict';
import test from 'node:test';
import { TraccarClient } from './traccarClient.js';
import type { TraccarConfig } from '../config/traccar.js';

const config: TraccarConfig = { apiUrl: 'https://traccar.test/api', webUrl: 'https://traccar.test', wsUrl: 'wss://traccar.test/api/socket', token: 'secret', requestTimeoutMs: 50, gt06Port: 5023, platformSource: 'KTagFinder', reconnectMinMs: 1, reconnectMaxMs: 10, restFallbackIntervalMs: 10, addressCacheTtlMs: 10, positionCacheTtlMs: 10, positionPersistIntervalMs: 300_000, writeTestEnabled: false };
test('busca por uniqueId e usa Bearer centralizado', async () => {
  let request: RequestInit | undefined; let url = '';
  const client = new TraccarClient(config, (async (input, init) => { url = String(input); request = init; return new Response(JSON.stringify([{ id: 7, uniqueId: '000007260412520' }]), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch);
  const device = await client.findDeviceByUniqueId('000007260412520');
  assert.equal(device?.id, 7); assert.equal(url, 'https://traccar.test/api/devices?uniqueId=000007260412520');
  assert.equal((request?.headers as Record<string, string>).Authorization, 'Bearer secret');
});
test('interpreta texto e 204', async () => {
  const textClient = new TraccarClient(config, (async () => new Response('Rua A', { headers: { 'content-type': 'text/plain' } })) as typeof fetch);
  assert.equal(await textClient.reverseGeocode(-5, -35), 'Rua A');
  const emptyClient = new TraccarClient(config, (async () => new Response(null, { status: 204 })) as typeof fetch);
  assert.equal(await emptyClient.deleteDevice(1), undefined);
});
test('aplica timeout e mensagem sanitizada', async () => {
  const client = new TraccarClient({ ...config, requestTimeoutMs: 5 }, ((_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as typeof fetch);
  await assert.rejects(() => client.health(), /Tempo limite/);
});
