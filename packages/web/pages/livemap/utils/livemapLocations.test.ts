import { describe, expect, it } from 'vitest';
import type { LocationHistory, Vehicle } from '../../../types';
import { preferFleetLocation, persistedFleetLocations } from './livemapLocations';

const point = (overrides: Partial<LocationHistory> = {}): LocationHistory => ({ id: 'tag-1', tagId: 'tag-1', lat: -8, lon: -36, conf: 100, status: 1, timestamp: 100, isodatetime: new Date(100).toISOString(), ...overrides });

describe('preferFleetLocation', () => {
  it('mantém o ponto mais novo', () => expect(preferFleetLocation(point({ timestamp: 200 }), point({ timestamp: 100 }))).toMatchObject({ timestamp: 200 }));
  it('promove o endereço resolvido mais recentemente no mesmo ponto', () => expect(preferFleetLocation(point({ address: 'Antigo', addressResolvedAt: 100 }), point({ address: 'Novo', addressResolvedAt: 200 }))).toMatchObject({ address: 'Novo' }));
  it('não deixa uma resposta sem endereço apagar o endereço atual', () => expect(preferFleetLocation(point({ address: 'Atual', addressResolvedAt: 200 }), point())).toMatchObject({ address: 'Atual' }));
  it('preserva endereço ao receber posição mais nova nas mesmas coordenadas', () => expect(preferFleetLocation(point({ address: 'Atual' }), point({ timestamp: 200 }))).toMatchObject({ timestamp: 200, address: 'Atual' }));
  it('não reutiliza endereço em coordenadas diferentes', () => expect(preferFleetLocation(point({ address: 'Local antigo' }), point({ timestamp: 200, lat: -9 }))).not.toHaveProperty('address'));
});

describe('persistedFleetLocations', () => {
  it('não mostra endereço da tag anterior como localização da tag atual', () => {
    const vehicles = [{ id: 'vehicle-1', tagId: 'tag-2', lastPosition: point({ tagId: 'tag-1', address: 'Endereço da tag anterior' }) }] as Vehicle[];
    expect(persistedFleetLocations(vehicles)).toEqual([]);
  });
  it('não presume a origem de posições legadas sem tagId', () => {
    expect(persistedFleetLocations([{ id: 'v', tagId: 'tag-2', lastPosition: point({ tagId: undefined }) }] as Vehicle[])).toEqual([]);
  });
  it('mantém a posição identificada da tag atual', () => {
    expect(persistedFleetLocations([{ id: 'v', tagId: 'tag-1', lastPosition: point({ address: 'Atual' }) }] as Vehicle[])).toMatchObject([{ tagId: 'tag-1', address: 'Atual' }]);
  });
});
