import assert from 'node:assert/strict';
import test from 'node:test';
import type { TraccarPosition } from '@ktag/shared';
import { isSafeToBlock } from './blocking.js';

const now = Date.parse('2026-10-01T12:00:00Z');
const position = (speed: number, fixTime: string, valid = true): TraccarPosition => ({ id: 1, deviceId: 1, latitude: -8, longitude: -35, altitude: 0, speed, course: 0, valid, fixTime, serverTime: fixTime, deviceTime: fixTime, attributes: {} });
test('bloqueio requer posição recente, válida e velocidade de até 3 km/h', () => {
  assert.equal(isSafeToBlock(position(1, '2026-10-01T11:59:30Z'), now), true);
  assert.equal(isSafeToBlock(position(2, '2026-10-01T11:59:30Z'), now), false);
  assert.equal(isSafeToBlock(position(0, '2026-10-01T11:57:00Z'), now), false);
  assert.equal(isSafeToBlock(position(0, '2026-10-01T11:59:30Z', false), now), false);
  assert.equal(isSafeToBlock(null, now), false);
});
