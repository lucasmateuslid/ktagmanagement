import { describe, expect, it } from 'vitest';
import type { LocationHistory, Vehicle } from '../../../types';
import { filterLocationsToRender } from './livemapFilters';
import { hasRecentVehiclePosition, vehicleDisplayTagId, vehicleEquipmentKind } from './vehicleTracking';

const vehicle = { id: 'vehicle-1', tagId: 'tag-1', trackerId: '490154203237518' } as Vehicle;
const position = (tagId: string, timestamp: number) => ({ id: tagId, tagId, timestamp, lat: -8.05, lon: -34.9 }) as LocationHistory;

describe('exibição de tag e rastreador no mapa', () => {
  it('identifica os equipamentos vinculados', () => {
    expect(vehicleEquipmentKind(vehicle)).toBe('both');
    expect(vehicleEquipmentKind({ tagId: 'tag-1' })).toBe('tag');
    expect(vehicleEquipmentKind({ trackerId: '490154203237518' })).toBe('tracker');
  });

  it('usa a posição mais recente e exibe apenas um marcador por veículo', () => {
    const locations = [position('tracker:490154203237518', 1000), position('tag-1', 2000)];
    expect(vehicleDisplayTagId(vehicle, locations)).toBe('tag-1');
    expect(filterLocationsToRender(locations, '', 'all', 'all', [vehicle]).map(item => item.tagId)).toEqual(['tag-1']);
    expect(filterLocationsToRender(locations, '', 'all', 'all', [vehicle], 'tracker')).toEqual([]);
    expect(filterLocationsToRender(locations, '', 'all', 'all', [vehicle], 'both').map(item => item.tagId)).toEqual(['tag-1']);
  });

  it('marca como offline uma posição antiga', () => {
    expect(hasRecentVehiclePosition(vehicle, [position('tag-1', 1000)], 301_001)).toBe(false);
    expect(hasRecentVehiclePosition(vehicle, [position('tag-1', 1000)], 300_999)).toBe(true);
  });

  it('ignora coordenadas inválidas ao escolher a fonte da posição', () => {
    const locations = [position('tag-1', 2000), { ...position('tracker:490154203237518', 3000), lat: 999 }];
    expect(vehicleDisplayTagId(vehicle, locations)).toBe('tag-1');
    expect(filterLocationsToRender(locations, '', 'all', 'all', [vehicle]).map(item => item.tagId)).toEqual(['tag-1']);
  });
  it('não coloca a posição de outro veículo sob esta placa', () => {
    const wrong = { ...position('tag-1', 3000), vehicleId: 'vehicle-2' };
    expect(vehicleDisplayTagId(vehicle, [wrong])).toBe('tracker:490154203237518');
    expect(hasRecentVehiclePosition(vehicle, [wrong], 3000)).toBe(false);
  });
});
