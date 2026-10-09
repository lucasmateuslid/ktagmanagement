import type { Client, LocationHistory, Tag, Vehicle } from '../../../types';
import { vehicleDisplayTagId } from './vehicleTracking';
import { hasValidCoordinates } from './livemapFilters';

export type FleetStatus = 'all' | 'online' | 'delayed' | 'offline' | 'no_position';
export type FleetLocationIndex = Map<string, LocationHistory[]>;

export function indexFleetLocations(locations: LocationHistory[]): FleetLocationIndex {
  const index: FleetLocationIndex = new Map();
  locations.forEach(location => {
    if (!location.tagId || !hasValidCoordinates(location)) return;
    const values = index.get(location.tagId) || [];
    values.push(location);
    index.set(location.tagId, values);
  });
  return index;
}

export function vehicleLocation(vehicle: Vehicle, locations: LocationHistory[], index?: FleetLocationIndex) {
  if (!index) {
    const id = vehicleDisplayTagId(vehicle, locations);
    return locations.find(location => location.tagId === id && (!location.vehicleId || location.vehicleId === vehicle.id) && hasValidCoordinates(location));
  }
  const ids = [vehicle.tagId, vehicle.trackerId ? `tracker:${vehicle.trackerId}` : ''].filter(Boolean);
  return ids.flatMap(id => index.get(id!) || [])
    .filter(location => !location.vehicleId || location.vehicleId === vehicle.id)
    .reduce<LocationHistory | undefined>((latest, location) => !latest || location.timestamp > latest.timestamp ? location : latest, undefined);
}

export function fleetStatus(vehicle: Vehicle, locations: LocationHistory[], now = Date.now(), communicationSeen = new Set<string>(), index?: FleetLocationIndex): Exclude<FleetStatus, 'all'> {
  const location = vehicleLocation(vehicle, locations, index);
  if (!location || !Number.isFinite(location.timestamp) || location.timestamp <= 0) {
    const previous = vehicle.lastPosition;
    const validPrevious = previous && previous.timestamp > 0 && (previous.tagId === vehicle.tagId || previous.tagId === `tracker:${vehicle.trackerId}`);
    return validPrevious || (vehicle.tagId && communicationSeen.has(vehicle.tagId)) ? 'offline' : 'no_position';
  }
  const age = now - location.timestamp;
  if (age >= 0 && age <= 5 * 60_000) return 'online';
  if (age >= 0 && age <= 12 * 60 * 60_000) return 'delayed';
  return 'offline';
}

export function fleetCounts(vehicles: Vehicle[], locations: LocationHistory[], now = Date.now(), communicationSeen = new Set<string>(), index = indexFleetLocations(locations)) {
  const counts = { all: vehicles.length, online: 0, delayed: 0, offline: 0, no_position: 0 };
  vehicles.forEach(vehicle => { counts[fleetStatus(vehicle, locations, now, communicationSeen, index)] += 1; });
  return counts;
}

export function searchVehicles(vehicles: Vehicle[], term: string, clients: Client[], tags: Tag[]) {
  const query = term.trim().toLocaleLowerCase('pt-BR');
  if (!query) return vehicles;
  const clientNames = new Map(clients.map(client => [client.id, client.name.toLocaleLowerCase('pt-BR')]));
  const tagNames = new Map(tags.map(tag => [tag.id, `${tag.name} ${tag.accessoryId} ${tag.imei || ''}`.toLocaleLowerCase('pt-BR')]));
  return vehicles.filter(vehicle => [
    vehicle.plate, vehicle.model, vehicle.trackerId || '',
    clientNames.get(vehicle.clientId || '') || '', tagNames.get(vehicle.tagId || '') || '',
  ].some(value => value.toLocaleLowerCase('pt-BR').includes(query)));
}

export function visibleFleetLocations(vehicles: Vehicle[], results: Vehicle[], selectedIds: string[], locations: LocationHistory[], activeTagId = '', index?: FleetLocationIndex) {
  const selected = new Set(selectedIds);
  const chosen = selected.size ? vehicles.filter(vehicle => selected.has(vehicle.id)) : results;
  const visibleIds = new Set(chosen.map(vehicle => index ? vehicleLocation(vehicle, locations, index)?.tagId || vehicle.trackerId && `tracker:${vehicle.trackerId}` || vehicle.tagId || '' : vehicleDisplayTagId(vehicle, locations)));
  if (activeTagId) visibleIds.add(activeTagId);
  const expectedVehicle = new Map(vehicles.flatMap(vehicle => [vehicle.tagId, vehicle.trackerId ? `tracker:${vehicle.trackerId}` : '']
    .filter(Boolean).map(id => [id, vehicle.id] as const)));
  return locations.filter(location => visibleIds.has(location.tagId) && hasValidCoordinates(location)
    && (!location.vehicleId || expectedVehicle.get(location.tagId) === location.vehicleId));
}
