import { useState, useEffect, useRef, useCallback } from 'react';
import { isTraccarTagModel, type LiveMapTrackedAsset } from '@ktag/shared';
import type { Tag, Vehicle, LocationHistory } from '../../../types';
import { activeTenant } from '../../../services/activeTenant';
import { traccarAssetLocation } from '../utils/traccarAsset';
import { trackingApi } from '../../../services/trackingApi';
import { hasValidCoordinates } from '../utils/livemapFilters';
import { mergeFleetLocations, persistedFleetLocations } from '../utils/livemapLocations';

export const useFleetTracking = (tags: Tag[], vehicles: Vehicle[]) => {
  const tenantId = activeTenant.id;
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshingRef = useRef(false);
  const tagsRef = useRef(tags);
  const vehiclesRef = useRef(vehicles);

  useEffect(() => {
    tagsRef.current = tags;
    vehiclesRef.current = vehicles;
  }, [tags, vehicles]);

  useEffect(() => {
    let disposed = false; let socket: WebSocket | null = null; let fallbackTimer: number | undefined;
    const mergeAsset = (asset: LiveMapTrackedAsset) => {
      if (disposed) return;
      const currentTags = tagsRef.current;
      const currentVehicles = vehiclesRef.current;
      const location = traccarAssetLocation(asset, currentTags, tenantId);
      if (!location || !hasValidCoordinates(location)) return;
      const vehicle = currentVehicles.find(item => item.id === location.vehicleId);
      if (!vehicle || (location.tagId.startsWith('tracker:')
        ? `tracker:${vehicle.trackerId}` !== location.tagId : vehicle.tagId !== location.tagId)) return;
      setFleetLocations(previous => mergeFleetLocations(previous, [location]));
    };
    const poll = (force = false) => {
      if (!force && socket?.readyState === WebSocket.OPEN) return;
      void trackingApi.liveMap().then(items => { if (!disposed) items.forEach(mergeAsset); }).catch(() => undefined);
    };
    const startFallback = () => {
      if (fallbackTimer !== undefined) return;
      fallbackTimer = window.setInterval(() => poll(), 60_000);
      poll(true);
    };
    const stopFallback = () => {
      if (fallbackTimer === undefined) return;
      window.clearInterval(fallbackTimer);
      fallbackTimer = undefined;
    };
    poll(true);
    void trackingApi.websocket().then(ws => {
      if (disposed) return ws.close(); socket = ws;
      ws.onopen = () => {
        stopFallback();
        poll(true);
      };
      ws.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === 'position') mergeAsset(message.data); if (!disposed && message.type === 'remove') setFleetLocations(previous => previous.filter(item => item.provider !== 'traccar' || `xadtag_${tagsRef.current.find(tag => isTraccarTagModel(tag.type) && tag.id === item.tagId)?.identifierNormalized}` !== message.id)); } catch { /* mensagem inválida */ } };
      ws.onclose = () => { socket = null; if (!disposed) startFallback(); };
      ws.onerror = () => { if (!disposed) startFallback(); };
    }).catch(() => { if (!disposed) startFallback(); });
    const connectionTimeout = window.setTimeout(() => {
      if (!disposed && socket?.readyState !== WebSocket.OPEN) startFallback();
    }, 60_000);
    return () => {
      disposed = true;
      window.clearTimeout(connectionTimeout);
      stopFallback();
      socket?.close();
    };
  }, [tenantId]);

  useEffect(() => {
    const persisted = persistedFleetLocations(vehicles).filter(hasValidCoordinates);
    if (!persisted.length) return;
    const timer = window.setTimeout(() => {
      setFleetLocations(previous => mergeFleetLocations(previous, persisted));
    }, 0);
    return () => window.clearTimeout(timer);
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
