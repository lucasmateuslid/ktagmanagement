import type { LocationHistory, Vehicle } from '../../../types';

export const safeLocationAddress = (address: string | null | undefined, provider?: string | null, verifiedAt?: number | null) =>
  provider && ['photon', 'openstreetmap', 'existing'].includes(provider) && !verifiedAt ? undefined : address || undefined;

const withoutLegacyAddress = (point: LocationHistory): LocationHistory => {
  const address = !point.addressResolutionProvider && point.provider === 'ktag' ? undefined
    : safeLocationAddress(point.address, point.addressResolutionProvider, point.addressVerifiedAt);
  return address === point.address ? point : { ...point, address };
};

const sameCoordinates = (left: LocationHistory, right: LocationHistory) =>
  Math.abs(left.lat - right.lat) < 0.00001 && Math.abs(left.lon - right.lon) < 0.00001;

/** Escolhe uma única verdade para o ponto atual e impede respostas antigas de sobrescreverem endereço novo. */
export const preferFleetLocation = (current: LocationHistory | undefined, incoming: LocationHistory): LocationHistory => {
  current = current && withoutLegacyAddress(current);
  incoming = withoutLegacyAddress(incoming);
  if (!current) return incoming;
  if (incoming.timestamp < current.timestamp) return current;
  const samePoint = sameCoordinates(current, incoming);
  if (incoming.timestamp > current.timestamp) {
    return samePoint && current.address && !incoming.address ? { ...incoming, address: current.address, addressResolvedAt: current.addressResolvedAt,
      addressResolutionProvider: current.addressResolutionProvider, addressVerifiedAt: current.addressVerifiedAt } : incoming;
  }
  if (!samePoint) return current;
  const currentResolution = Number(current.addressResolvedAt || 0);
  const incomingResolution = Number(incoming.addressResolvedAt || 0);
  if (current.address && (!incoming.address || currentResolution > incomingResolution)) return { ...incoming, address: current.address, addressResolvedAt: current.addressResolvedAt,
    addressResolutionProvider: current.addressResolutionProvider, addressVerifiedAt: current.addressVerifiedAt };
  return { ...current, ...incoming };
};

export const mergeFleetLocations = (current: LocationHistory[], incoming: LocationHistory[]) => {
  const merged = new Map(current.filter(item => item.tagId).map(item => [item.tagId, item]));
  incoming.forEach(item => { if (item.tagId) merged.set(item.tagId, preferFleetLocation(merged.get(item.tagId), item)); });
  return [...merged.values()];
};

/** Não atribui uma posição antiga à nova tag vinculada ao veículo. */
export const persistedFleetLocations = (vehicles: Vehicle[]): LocationHistory[] => vehicles.flatMap(vehicle => {
  const position = vehicle.lastPosition;
  if (!vehicle.tagId || !position || position.tagId !== vehicle.tagId) return [];
  return [withoutLegacyAddress({ ...position, tagId: vehicle.tagId, vehicleId: vehicle.id })];
});
