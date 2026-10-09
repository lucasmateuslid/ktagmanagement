import type { LocationHistory, Vehicle } from '../../../types';

export type EquipmentFilter = 'all' | 'tag' | 'tracker' | 'both';
export type EquipmentKind = Exclude<EquipmentFilter, 'all'> | 'none';

export function vehicleEquipmentKind(vehicle: Pick<Vehicle, 'tagId' | 'trackerId'>): EquipmentKind {
  if (vehicle.tagId && vehicle.trackerId) return 'both';
  if (vehicle.trackerId) return 'tracker';
  if (vehicle.tagId) return 'tag';
  return 'none';
}

const latestValidLocation = (id: string, locations: LocationHistory[], vehicleId?: string) => locations
  .filter(location => location.tagId === id && (!vehicleId || !location.vehicleId || location.vehicleId === vehicleId) && Number.isFinite(location.timestamp)
    && Number.isFinite(location.lat) && location.lat >= -90 && location.lat <= 90
    && Number.isFinite(location.lon) && location.lon >= -180 && location.lon <= 180)
  .reduce<LocationHistory | null>((latest, location) => !latest || location.timestamp > latest.timestamp ? location : latest, null);

export function vehicleDisplayTagId(vehicle: Pick<Vehicle, 'tagId' | 'trackerId'> & Partial<Pick<Vehicle, 'id'>>, locations: LocationHistory[]): string {
  const trackerId = vehicle.trackerId ? `tracker:${vehicle.trackerId}` : '';
  const tagId = vehicle.tagId || '';
  const trackerLocation = trackerId ? latestValidLocation(trackerId, locations, vehicle.id) : null;
  const tagLocation = tagId ? latestValidLocation(tagId, locations, vehicle.id) : null;
  if (trackerLocation && tagLocation) return trackerLocation.timestamp >= tagLocation.timestamp ? trackerId : tagId;
  if (trackerLocation) return trackerId;
  if (tagLocation) return tagId;
  return trackerId || tagId;
}

export function hasRecentVehiclePosition(vehicle: Pick<Vehicle, 'tagId' | 'trackerId'> & Partial<Pick<Vehicle, 'id'>>, locations: LocationHistory[], now = Date.now()): boolean {
  const id = vehicleDisplayTagId(vehicle, locations);
  const location = latestValidLocation(id, locations, vehicle.id);
  return Boolean(location && Number.isFinite(location.timestamp) && now - location.timestamp >= 0 && now - location.timestamp <= 300_000);
}
