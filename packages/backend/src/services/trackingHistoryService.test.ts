import assert from 'node:assert/strict';
import test from 'node:test';
import type { TrackingHistoryPoint } from '@ktag/shared';
import { normalizeHistoryPoints, parseHistoryRange } from './trackingHistoryService.js';

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
