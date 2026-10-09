import assert from 'node:assert/strict';
import test from 'node:test';
import { canPromotePosition, canPromoteVehiclePosition, positionAgeMinutes, validPosition } from './currentPosition.js';

const now = 1_800_000_000_000;
const current = { id: 'p1', tagId: 'tag-a', timestamp: now - 60_000, lat: -8.05, lon: -34.9 };

test('rejects positions from another tag, an old assignment, invalid coordinates and future timestamps', () => {
  assert.equal(canPromotePosition('tag-b', current, null, now), false);
  assert.equal(canPromotePosition('tag-a', { ...current, timestamp: now - 120_000 }, current, now), false);
  assert.equal(validPosition({ ...current, lat: 0, lon: 0 }, now), false);
  assert.equal(validPosition({ ...current, timestamp: now + 10 * 60_000 }, now), false);
});

test('accepts a newer point after a tag change and reports real age', () => {
  assert.equal(canPromotePosition('tag-a', current, { ...current, tagId: 'tag-b', timestamp: now }, now), true);
  assert.equal(positionAgeMinutes(current.timestamp, now), 1);
  assert.equal(canPromotePosition('tag-a', { ...current, lon: -35 }, current, now), false);
});

test('keeps the newest position when a vehicle has both a tag and a tracker', () => {
  const trackerPoint = { ...current, id: 'tracker-point', tagId: 'tracker:tracker-a', timestamp: now - 10_000 };
  assert.equal(canPromoteVehiclePosition('tag-a', 'tracker-a', current, trackerPoint, now), false);
  assert.equal(canPromoteVehiclePosition('tag-a', 'tracker-a', { ...current, timestamp: now }, trackerPoint, now), true);
  assert.equal(canPromoteVehiclePosition('tag-a', 'tracker-a', trackerPoint, current, now), true);
  assert.equal(canPromoteVehiclePosition('tag-a', 'tracker-a', { ...current, tagId: 'tag-b' }, current, now), false);
  assert.equal(canPromoteVehiclePosition('tag-a', 'tracker-a', current, { ...current, tagId: 'old-tag', timestamp: now }, now), true);
});
