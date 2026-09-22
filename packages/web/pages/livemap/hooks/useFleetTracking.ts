import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveMapTrackedAsset } from '@ktag/shared';
import type { Tag, Vehicle, LocationHistory } from '../../../types';
import { trackingApi } from '../../../services/trackingApi';
import { hasValidCoordinates } from '../utils/livemapFilters';
import { mergeFleetLocations } from '../utils/livemapLocations';

export const useFleetTracking = (tags: Tag[], vehicles: Vehicle[]) => {
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    let disposed = false; let socket: WebSocket | null = null;
    const mergeAsset = (asset: LiveMapTrackedAsset) => {
      const tag = tags.find(item => item.identifierNormalized === asset.uniqueId);
      const tagId = tag?.id || asset.id.replace('xadtag_', '');
      const location = { id: tagId, tagId, lat: asset.latitude, lon: asset.longitude, timestamp: Date.parse(asset.fixTime || asset.serverTime || '') || Date.now(), isodatetime: asset.fixTime || asset.serverTime || new Date().toISOString(), conf: asset.valid ? 100 : 0, status: asset.status === 'online' ? 1 : 0, address: asset.address || undefined, battery: { level: 0, label: asset.status, color: asset.status === 'online' ? '#10b981' : '#71717a' } } as LocationHistory;
      if (!tagId || !hasValidCoordinates(location)) return;
      setFleetLocations(previous => mergeFleetLocations(previous, [location]));
    };
    void trackingApi.liveMap().then(items => { if (!disposed) items.forEach(mergeAsset); }).catch(() => undefined);
    void trackingApi.websocket().then(ws => {
      if (disposed) return ws.close(); socket = ws;
      ws.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === 'position') mergeAsset(message.data); if (message.type === 'remove') setFleetLocations(previous => previous.filter(item => `xadtag_${tags.find(tag => tag.id === item.tagId)?.identifierNormalized}` !== message.id)); } catch { /* mensagem inválida */ } };
    }).catch(() => undefined);
    return () => { disposed = true; socket?.close(); };
  }, [tags]);

  useEffect(() => {
    const persisted = vehicles.filter(vehicle => vehicle.lastPosition && vehicle.tagId && hasValidCoordinates(vehicle.lastPosition)).map(vehicle => ({ ...vehicle.lastPosition!, tagId: vehicle.tagId!, id: vehicle.tagId! }));
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
