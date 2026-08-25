import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchKtagWithRetry, ktagHistoryPointId, normalizeKtagSnapshot } from './ktagHistoryCapture.js';

test('normaliza segundos e gera ID idempotente', () => {
  const point = normalizeKtagSnapshot({ timestamp: 1_700_000_000, lat: -8, lon: -35, conf: 10, status: 3 });
  assert.equal(point?.timestamp, 1_700_000_000_000);
  assert.equal(ktagHistoryPointId('tag-1', point!), ktagHistoryPointId('tag-1', point!));
});

test('rejeita timestamps e coordenadas inválidos', () => {
  assert.equal(normalizeKtagSnapshot({ timestamp: 0, lat: -8, lon: -35 }), null);
  assert.equal(normalizeKtagSnapshot({ timestamp: 1_700_000_000, lat: 0, lon: 0 }), null);
  assert.equal(normalizeKtagSnapshot({ timestamp: 1_700_000_000, lat: -91, lon: -35 }), null);
});

test('repete 429 e 5xx com backoff antes de retornar', async () => {
  const statuses = [429, 500, 200]; const delays: number[] = [];
  const response = await fetchKtagWithRetry(async () => new Response('{}', { status: statuses.shift()! }), { attempts: 4, baseDelayMs: 10, random: () => 0, sleep: async ms => { delays.push(ms); } });
  assert.equal(response.status, 200); assert.deepEqual(delays, [10, 20]);
});

test('não repete erros 4xx permanentes', async () => {
  let calls = 0; const response = await fetchKtagWithRetry(async () => { calls++; return new Response('{}', { status: 401 }); });
  assert.equal(response.status, 401); assert.equal(calls, 1);
});
