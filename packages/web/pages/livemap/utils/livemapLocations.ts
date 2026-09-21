import type { LocationHistory } from '../../../types';

const sameCoordinates = (left: LocationHistory, right: LocationHistory) =>
  Math.abs(left.lat - right.lat) < 0.00001 && Math.abs(left.lon - right.lon) < 0.00001;

/** Escolhe uma única verdade para o ponto atual e impede respostas antigas de sobrescreverem endereço novo. */
export const preferFleetLocation = (current: LocationHistory | undefined, incoming: LocationHistory): LocationHistory => {
  if (!current) return incoming;
  if (incoming.timestamp < current.timestamp) return current;
  const samePoint = sameCoordinates(current, incoming);
  if (incoming.timestamp > current.timestamp) {
    return samePoint && current.address && !incoming.address ? { ...incoming, address: current.address, addressResolvedAt: current.addressResolvedAt } : incoming;
  }
  if (!samePoint) return incoming;
  const currentResolution = Number(current.addressResolvedAt || 0);
  const incomingResolution = Number(incoming.addressResolvedAt || 0);
  if (current.address && (!incoming.address || currentResolution > incomingResolution)) return { ...incoming, address: current.address, addressResolvedAt: current.addressResolvedAt, addressResolutionProvider: current.addressResolutionProvider };
  return { ...current, ...incoming };
};

export const mergeFleetLocations = (current: LocationHistory[], incoming: LocationHistory[]) => {
  const merged = new Map(current.filter(item => item.tagId).map(item => [item.tagId, item]));
  incoming.forEach(item => { if (item.tagId) merged.set(item.tagId, preferFleetLocation(merged.get(item.tagId), item)); });
  return [...merged.values()];
};
