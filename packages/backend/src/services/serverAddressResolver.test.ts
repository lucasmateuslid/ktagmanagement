import assert from 'node:assert/strict';
import test from 'node:test';
import { displayAddressAt, photonAddressForPoint, reusableAddressAt } from './serverAddressResolver.js';

test('rejects a reverse-geocoder feature far from the requested coordinates', () => {
  const latitude = -5.742603;
  const longitude = -35.266183;
  const far = { features: [{ geometry: { coordinates: [-35.25, -5.73] }, properties: { street: 'Rua Errada', city: 'Natal' } }] };
  assert.equal(photonAddressForPoint(far, latitude, longitude), null);
  const near = { features: [{ geometry: { coordinates: [-35.26618, -5.74260] }, properties: { street: 'Rua Correta', city: 'Natal' } }] };
  assert.equal(photonAddressForPoint(near, latitude, longitude), 'Rua Correta, Natal');
  assert.equal(photonAddressForPoint({ features: [{ properties: { street: 'Sem coordenadas' } }] }, latitude, longitude), null);
});

test('reuses only source-bound addresses at the same coordinates', () => {
  const point = { lat: -5.742603, lon: -35.266183, address: 'Rua A', provider: 'ktag', addressResolutionProvider: 'openstreetmap' };
  assert.equal(reusableAddressAt(point, point.lat, point.lon), '');
  assert.equal(displayAddressAt(point), null);
  assert.equal(displayAddressAt({ ...point, addressResolutionProvider: null }), null);
  assert.equal(reusableAddressAt({ ...point, addressResolutionProvider: 'traccar' }, point.lat, point.lon), 'Rua A');
  assert.equal(displayAddressAt({ ...point, addressResolutionProvider: 'traccar' }), 'Rua A');
  assert.equal(reusableAddressAt({ ...point, addressResolutionProvider: 'traccar' }, -5.76, -35.28), '');
});
