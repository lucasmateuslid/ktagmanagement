import assert from 'node:assert/strict';
import test from 'node:test';
import type { TraccarDevice, TraccarPosition } from '@ktag/shared';
import { communicationStatus } from './communicationStatus.js';

const now = Date.parse('2026-08-22T13:30:00.000Z');
const device = (status: TraccarDevice['status'], lastUpdate?: string): TraccarDevice => ({
  id: 1, name: 'tag', uniqueId: '000007260509662', status, disabled: false,
  attributes: {}, ...(lastUpdate ? { lastUpdate } : {}),
});
const position = (serverTime: string): TraccarPosition => ({
  id: 1, deviceId: 1, latitude: -5, longitude: -35, altitude: 0, speed: 0,
  course: 0, deviceTime: serverTime, fixTime: serverTime, serverTime, valid: true, attributes: {},
});

test('considera online uma XADTAG que enviou posição recente e fechou o socket', () => {
  assert.equal(communicationStatus(device('offline'), position('2026-08-22T13:25:00.000Z'), now), 'online');
});
test('classifica atividade antiga como atrasada ou offline', () => {
  assert.equal(communicationStatus(device('offline', '2026-08-22T12:30:00.000Z'), null, now), 'delayed');
  assert.equal(communicationStatus(device('offline', '2026-08-21T12:29:59.000Z'), null, now), 'offline');
});
test('conexão TCP online continua tendo prioridade', () => {
  assert.equal(communicationStatus(device('online'), null, now), 'online');
});
