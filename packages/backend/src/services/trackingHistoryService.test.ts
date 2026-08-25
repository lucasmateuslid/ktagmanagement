import assert from 'node:assert/strict';
import test from 'node:test';
import type { TrackingHistoryPoint } from '@ktag/shared';
import { HistoryRequestError, mapProviderError, normalizeHistoryPoints, normalizeTraccarPosition, parseHistoryRange } from './trackingHistoryService.js';
import { TraccarHttpError } from './traccarClient.js';

const point = (id: string, timestamp: number): TrackingHistoryPoint => ({ id, tagId: 'tag-1', vehicleId: 'vehicle-1', provider: 'ktag', timestamp, latitude: -8, longitude: -35 });

test('aceita até 30 dias e rejeita intervalos maiores', () => {
  const to = Date.now();
  assert.equal(parseHistoryRange({ from: new Date(to - 30 * 86_400_000).toISOString(), to: new Date(to).toISOString() }).limit, 500);
  assert.throws(() => parseHistoryRange({ from: new Date(to - 31 * 86_400_000).toISOString(), to: new Date(to).toISOString() }), /máximo de 30 dias/);
});

test('ordena do mais recente e elimina duplicatas exatas', () => {
  const range = { from: 1, to: 100, limit: 10, cursor: null };
  const values = normalizeHistoryPoints([point('a', 10), point('b', 20), point('a', 10)], range);
  assert.deepEqual(values.map(item => item.id), ['b', 'a']);
});

test('exige intervalo e limita a página', () => {
  assert.throws(() => parseHistoryRange({}), (error: unknown) => error instanceof HistoryRequestError && error.code === 'INVALID_RANGE');
  const to = Date.now();
  assert.throws(() => parseHistoryRange({ from: new Date(to - 1_000).toISOString(), to: new Date(to).toISOString(), limit: 1501 }), /máximo de 1500/);
});

test('normaliza segundos e rejeita coordenadas inválidas do Traccar', () => {
  const raw = (id: number, latitude: number, longitude: number) => ({ id, deviceId: 2, latitude, longitude, valid: true, altitude: 0, speed: 0, course: 0, deviceTime: '2026-08-24T12:00:00Z', fixTime: '2026-08-24T12:00:00Z', serverTime: '2026-08-24T12:00:00Z', attributes: {} });
  const valid = normalizeTraccarPosition('tag-1', 'vehicle-1', { ...raw(7, -8, -35), attributes: { batteryLevel: 80 } });
  assert.equal(valid?.timestamp, Date.parse('2026-08-24T12:00:00Z'));
  assert.equal(valid?.battery?.level, 80);
  assert.equal(normalizeTraccarPosition('tag-1', null, raw(8, 0, 0)), null);
  assert.equal(normalizeTraccarPosition('tag-1', null, raw(9, 91, -35)), null);
});

test('deduplica pela chave lógica mesmo com IDs diferentes', () => {
  const range = { from: 1, to: 100, limit: 10, cursor: null };
  const values = normalizeHistoryPoints([point('provider-a', 10), point('provider-b', 10)], range);
  assert.equal(values.length, 1);
});

test('mapeia falhas conhecidas do provedor', () => {
  assert.equal(mapProviderError(new TraccarHttpError(429, 'route', 'rate')).code, 'PROVIDER_RATE_LIMITED');
  assert.equal(mapProviderError(new Error('Tempo limite excedido ao consultar o Traccar.')).status, 504);
});
