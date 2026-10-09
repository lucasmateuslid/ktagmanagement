import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveMapTrackedAsset } from '@ktag/shared';
import type { Tag, Vehicle, LocationHistory } from '../../../types';
import { activeTenant } from '../../../services/activeTenant';
import { traccarAssetLocation } from '../utils/traccarAsset';
import { trackingApi } from '../../../services/trackingApi';
import { hasValidCoordinates } from '../utils/livemapFilters';
import { mergeFleetLocations, persistedFleetLocations } from '../utils/livemapLocations';

export const useFleetTracking = (tags: Tag[], vehicles: Vehicle[]) => {
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let disposed = false; let socket: WebSocket | null = null;
    const mergeAsset = (asset: LiveMapTrackedAsset) => {
      if (disposed) return;
      const location = traccarAssetLocation(asset, tags, activeTenant.id);
      if (!location || !hasValidCoordinates(location)) return;
      const vehicle = vehicles.find(item => item.id === location.vehicleId);
      if (!vehicle || (location.tagId.startsWith('tracker:')
        ? `tracker:${vehicle.trackerId}` !== location.tagId : vehicle.tagId !== location.tagId)) return;
      setFleetLocations(previous => mergeFleetLocations(previous, [location]));
    };
    const poll = () => void trackingApi.liveMap().then(items => { if (!disposed) items.forEach(mergeAsset); }).catch(() => undefined);
    poll(); const interval = window.setInterval(poll, 15_000);
    void trackingApi.websocket().then(ws => {
      if (disposed) return ws.close(); socket = ws;
      ws.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === 'position') mergeAsset(message.data); if (!disposed && message.type === 'remove') setFleetLocations(previous => previous.filter(item => item.provider !== 'traccar' || `xadtag_${tags.find(tag => tag.type === 'XADTAG' && tag.id === item.tagId)?.identifierNormalized}` !== message.id)); } catch { /* mensagem inválida */ } };
    }).catch(() => undefined);
    return () => { disposed = true; window.clearInterval(interval); socket?.close(); };
  }, [tags, vehicles]);

  useEffect(() => {
    const persisted = persistedFleetLocations(vehicles).filter(hasValidCoordinates);
    if (persisted.length) setFleetLocations(previous => mergeFleetLocations(previous, persisted));
  }, [vehicles]);

  const fetchUpdate = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true; setLoading(true);
    try {
      const report = await trackingApi.refreshFleet();
      setFleetLocations(previous => mergeFleetLocations(previous, report.locations.filter(hasValidCoordinates) as LocationHistory[]));
      return report;
    } finally { refreshingRef.current = false; setLoading(false); }
  }, []);

  const refreshTag = useCallback(async (tagId: string) => {
    if (tagId.startsWith('tracker:')) {
      const vehicle = vehicles.find(item => `tracker:${item.trackerId}` === tagId);
      if (!vehicle) throw new Error('Rastreador sem veículo vinculado.');
      const position = await trackingApi.vehiclePosition(vehicle.id);
      const location = { ...position, tagId, vehicleId: vehicle.id } as LocationHistory;
      if (!hasValidCoordinates(location)) throw new Error('Rastreador sem posição válida.');
      const previous = fleetLocations.find(item => item.tagId === tagId);
      setFleetLocations(previous => mergeFleetLocations(previous, [location]));
      return { status: position.status || (position.degraded ? 'error' as const : previous && location.timestamp <= previous.timestamp ? 'unchanged' as const : 'updated' as const),
        ageMinutes: Math.max(0, Math.floor((Date.now() - location.timestamp) / 60_000)), provider: 'traccar' as const,
        error: position.degraded ? 'Traccar indisponível; exibindo a última posição conhecida.' : undefined };
    }
    const tag = tags.find(item => item.id === tagId);
    if (!tag) throw new Error('Equipamento não encontrado.');
    const result = await trackingApi.refreshTag(tagId);
    const location = result.position as LocationHistory;
    const vehicle = vehicles.find(item => item.tagId === tagId);
    if (location && hasValidCoordinates(location) && (!vehicle || !location.vehicleId || location.vehicleId === vehicle.id))
      setFleetLocations(previous => mergeFleetLocations(previous, [location]));
    return result;
  }, [tags, vehicles, fleetLocations]);

  const injectLocations = useCallback((locations: LocationHistory[]) => {
    setFleetLocations(previous => mergeFleetLocations(previous, locations.filter(hasValidCoordinates)));
  }, []);

  return { fleetLocations, loading, manualRefresh: fetchUpdate, refreshTag, injectLocations };
};
