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
      setFleetLocations(previous => mergeFleetLocations(previous, [location]));
    };
    void trackingApi.liveMap().then(items => { if (!disposed) items.forEach(mergeAsset); }).catch(() => undefined);
    void trackingApi.websocket().then(ws => {
      if (disposed) return ws.close(); socket = ws;
      ws.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === 'position') mergeAsset(message.data); if (!disposed && message.type === 'remove') setFleetLocations(previous => previous.filter(item => item.provider !== 'traccar' || `xadtag_${tags.find(tag => tag.type === 'XADTAG' && tag.id === item.tagId)?.identifierNormalized}` !== message.id)); } catch { /* mensagem inválida */ } };
    }).catch(() => undefined);
    return () => { disposed = true; socket?.close(); };
  }, [tags]);

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
    if (!tags.some(tag => tag.id === tagId)) return;
    const location = await trackingApi.refreshTag(tagId) as LocationHistory;
    if (hasValidCoordinates(location)) setFleetLocations(previous => mergeFleetLocations(previous, [location]));
  }, [tags]);

  const injectLocations = useCallback((locations: LocationHistory[]) => {
    setFleetLocations(previous => mergeFleetLocations(previous, locations.filter(hasValidCoordinates)));
  }, []);

  return { fleetLocations, loading, manualRefresh: fetchUpdate, refreshTag, injectLocations };
};
