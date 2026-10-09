import { describe, expect, it } from 'vitest';
import type { Client, LocationHistory, Tag, Vehicle } from '../../../types';
import { fleetCounts, fleetStatus, indexFleetLocations, searchVehicles, vehicleLocation, visibleFleetLocations } from './fleetView';

const vehicle = (id: string, extra: Partial<Vehicle> = {}) => ({ id, plate: id, model: 'ONIX', type: 'car', tagId: `tag-${id}`, createdAt: 1, ...extra }) as Vehicle;
const location = (tagId: string, timestamp: number) => ({ id: tagId, tagId, lat: -5.7, lon: -35.2, timestamp }) as LocationHistory;

describe('fleet view', () => {
  it('classifies communication at the agreed thresholds and counts missing positions', () => {
    const now = 1_000_000_000;
    const vehicles = [vehicle('online'), vehicle('delayed'), vehicle('offline'), vehicle('missing')];
    const locations = [location('tag-online', now - 300_000), location('tag-delayed', now - 300_001), location('tag-offline', now - 12 * 3_600_000 - 1)];
    expect(fleetStatus(vehicles[0], locations, now)).toBe('online');
    expect(fleetStatus(vehicles[1], locations, now)).toBe('delayed');
    expect(fleetStatus(vehicles[2], locations, now)).toBe('offline');
    expect(fleetStatus(vehicles[3], locations, now)).toBe('no_position');
    expect(fleetCounts(vehicles, locations, now)).toEqual({ all: 4, online: 1, delayed: 1, offline: 1, no_position: 1 });
  });

  it('separates equipment that communicated before from equipment that never reported a position', () => {
    const previouslySeen = vehicle('seen');
    const neverSeen = vehicle('never');
    const seen = new Set(['tag-seen']);
    expect(fleetStatus(previouslySeen, [], 1_000_000_000, seen)).toBe('offline');
    expect(fleetStatus(neverSeen, [], 1_000_000_000, seen)).toBe('no_position');
    expect(fleetCounts([previouslySeen, neverSeen], [], 1_000_000_000, seen)).toEqual({ all: 2, online: 0, delayed: 0, offline: 1, no_position: 1 });
  });

  it('uses the newest equipment location and searches vehicle, client and equipment data', () => {
    const item = vehicle('QGM9G85', { trackerId: '123456', clientId: 'c1' });
    const locations = [location('tag-QGM9G85', 100), location('tracker:123456', 200)];
    const clients = [{ id: 'c1', name: 'Douglas Marinheiro' }] as Client[];
    const tags = [{ id: 'tag-QGM9G85', name: 'K-TAG', accessoryId: 'K300070' }] as Tag[];
    expect(vehicleLocation(item, locations)?.tagId).toBe('tracker:123456');
    const index = indexFleetLocations(locations);
    expect(vehicleLocation(item, locations, index)?.tagId).toBe('tracker:123456');
    expect(visibleFleetLocations([item], [item], [], locations, '', index)).toEqual([locations[1]]);
    for (const query of ['qgm9', 'onix', 'douglas', '123456', 'K300070']) {
      expect(searchVehicles([item], query, clients, tags)).toEqual([item]);
    }
    expect(searchVehicles([item], 'nao existe', clients, tags)).toEqual([]);
  });

  it('shows selected vehicles on the map and falls back to filtered results', () => {
    const first = vehicle('ONE');
    const second = vehicle('TWO');
    const locations = [location('tag-ONE', 100), location('tag-TWO', 200)];
    expect(visibleFleetLocations([first, second], [second], [], locations)).toEqual([locations[1]]);
    expect(visibleFleetLocations([first, second], [second], ['ONE'], locations)).toEqual([locations[0]]);
    expect(visibleFleetLocations([first, second], [second], ['ONE'], locations, 'tag-TWO')).toEqual(locations);
  });
});
