export type CurrentPosition = { tagId: string; timestamp: number; lat: number; lon: number; id?: string; address?: string | null };

export const validPosition = (point: CurrentPosition | null | undefined, now = Date.now()): point is CurrentPosition =>
  Boolean(point && point.tagId && Number.isFinite(point.timestamp) && point.timestamp > 0
    && point.timestamp <= now + 5 * 60_000 && Number.isFinite(point.lat) && Number.isFinite(point.lon)
    && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180
    && !(point.lat === 0 && point.lon === 0));

/** Never move a vehicle back in time or write a position for an obsolete assignment. */
export const canPromotePosition = (linkedTagId: string | null | undefined, incoming: CurrentPosition,
  previous: CurrentPosition | null | undefined, now = Date.now()) => {
  if (linkedTagId !== incoming.tagId || !validPosition(incoming, now)) return false;
  if (!previous || previous.tagId !== linkedTagId || !validPosition(previous, now)) return true;
  return incoming.timestamp > previous.timestamp || (incoming.timestamp === previous.timestamp && incoming.id === previous.id
    && incoming.lat === previous.lat && incoming.lon === previous.lon);
};

/** A vehicle may have a tag and a tracker; preserve the newest point across both active sources. */
export const canPromoteVehiclePosition = (linkedTagId: string | null | undefined, linkedTrackerId: string | null | undefined,
  incoming: CurrentPosition, previous: CurrentPosition | null | undefined, now = Date.now()) => {
  const activeIds = [linkedTagId, linkedTrackerId ? `tracker:${linkedTrackerId}` : null].filter(Boolean);
  if (!activeIds.includes(incoming.tagId) || !validPosition(incoming, now)) return false;
  if (!previous || !activeIds.includes(previous.tagId) || !validPosition(previous, now)) return true;
  if (incoming.timestamp > previous.timestamp) return true;
  return incoming.timestamp === previous.timestamp && incoming.tagId === previous.tagId
    && incoming.id === previous.id && incoming.lat === previous.lat && incoming.lon === previous.lon;
};

export const positionAgeMinutes = (timestamp: number | null | undefined, now = Date.now()) =>
  timestamp && Number.isFinite(timestamp) && timestamp <= now ? Math.floor((now - timestamp) / 60_000) : null;

export const afterVehicleLink = (positionTimestamp: number, linkedAt: unknown) =>
  !Number.isFinite(Number(linkedAt)) || Number(linkedAt) <= 0 || positionTimestamp >= Number(linkedAt);

export const distanceBetweenPositionsMeters = (
  first: Pick<CurrentPosition, 'lat' | 'lon'> | null | undefined,
  second: Pick<CurrentPosition, 'lat' | 'lon'> | null | undefined,
) => {
  if (!first || !second) return Number.POSITIVE_INFINITY;
  const radius = 6_371_000;
  const lat1 = first.lat * Math.PI / 180;
  const lat2 = second.lat * Math.PI / 180;
  const deltaLat = (second.lat - first.lat) * Math.PI / 180;
  const deltaLon = (second.lon - first.lon) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const shouldPersistPosition = (
  previous: CurrentPosition | null | undefined,
  next: CurrentPosition,
  lastPersistAt: number | undefined,
  now = Date.now(),
  intervalMs = 300_000,
  distanceMeters = 30,
) => !previous
  || !lastPersistAt
  || now - lastPersistAt >= intervalMs
  || distanceBetweenPositionsMeters(previous, next) >= distanceMeters;

export const withoutUndefined = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
