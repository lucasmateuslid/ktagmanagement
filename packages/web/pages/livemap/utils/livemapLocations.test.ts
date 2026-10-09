import { describe, expect, it } from 'vitest';
import { persistedFleetLocations, preferFleetLocation, safeLocationAddress } from './livemapLocations';
import type { LocationHistory } from '../../../types';

const point = (overrides: Partial<LocationHistory> = {}): LocationHistory => ({
  id: 'p1', tagId: 'tag-1', lat: -5.742603, lon: -35.266183,
  timestamp: 1_800_000_000_000, isodatetime: new Date(1_800_000_000_000).toISOString(),
  conf: 100, status: 1, provider: 'traccar', ...overrides,
});

describe('endereço do Livemap', () => {
  it('não mostra endereço público antigo sem validação de distância', () => {
    expect(safeLocationAddress('Rua errada', 'openstreetmap')).toBeUndefined();
    expect(safeLocationAddress('Rua validada', 'photon', 1_800_000_000_000)).toBe('Rua validada');
    expect(safeLocationAddress('Rua do Traccar', 'traccar')).toBe('Rua do Traccar');
  });

  it('não carrega endereço anterior quando as coordenadas mudam', () => {
    const old = point({ address: 'Rua A', addressResolutionProvider: 'traccar' });
    const next = point({ id: 'p2', lat: -5.76, lon: -35.28, timestamp: old.timestamp + 60_000, address: undefined });
    expect(preferFleetLocation(old, next).address).toBeUndefined();
    expect(preferFleetLocation(point({ ...old, addressResolutionProvider: 'openstreetmap' }), point({ ...old, address: undefined })).address).toBeUndefined();
  });

  it('oculta endereço antigo sem origem em posição K-TAG persistida', () => {
    const vehicle = { id: 'v1', tagId: 'tag-1', lastPosition: point({ provider: 'ktag', address: 'Endereço antigo' }) };
    expect(persistedFleetLocations([vehicle as any])[0].address).toBeUndefined();
  });
});
