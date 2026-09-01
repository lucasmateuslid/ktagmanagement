import type { TrackingHistoryPoint } from '@ktag/shared';
import type { LocationHistory } from '../../../types';

export const locationHistoryKey = (point: Pick<LocationHistory, 'tagId' | 'timestamp' | 'lat' | 'lon'>) => `${point.tagId}|${point.timestamp}|${point.lat}|${point.lon}`;

export const trackingPointToLocation = (point: TrackingHistoryPoint): LocationHistory => ({
  id: point.id, tagId: point.tagId, lat: point.latitude, lon: point.longitude,
  timestamp: point.timestamp, isodatetime: new Date(point.timestamp).toISOString(),
  conf: point.accuracy ?? 100, status: 1, address: point.address || undefined,
  vehicleId: point.vehicleId || undefined, provider: point.provider, speed: point.speed,
  course: point.course, altitude: point.altitude,
  battery: point.battery ? { level: point.battery.level, label: point.battery.label || 'Não informado', color: point.battery.color || '#71717a' } : undefined,
});

export const mergeHistoryLocations = (points: LocationHistory[]) => {
  const values = new Map<string, LocationHistory>();
  for (const point of points) {
    const key = locationHistoryKey(point); const existing = values.get(key);
    if (!existing || point.id.localeCompare(existing.id) < 0) values.set(key, point);
  }
  return [...values.values()].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
};
