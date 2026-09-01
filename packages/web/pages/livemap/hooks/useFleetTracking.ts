
import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTagsLocationBatch } from '../../../services/api';
import { Tag, Vehicle, LocationHistory } from '../../../types';
import { storage } from '../../../services/storage';
import { trackingApi } from '../../../services/trackingApi';
import type { LiveMapTrackedAsset } from '@ktag/shared';

export const useFleetTracking = (tags: Tag[], vehicles: Vehicle[], selectedTagId: string) => {
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshingTagIdsRef = useRef(new Set<string>());
  // Controle de última gravação no banco para economizar writes (Throttling)
  const lastSaveRef = useRef<Record<string, number>>({});
  useEffect(() => {
    let disposed = false; let socket: WebSocket | null = null;
    const mergeAsset = (asset: LiveMapTrackedAsset) => { const tag = tags.find(item => item.identifierNormalized === asset.uniqueId); const tagId = tag?.id || asset.id.replace('xadtag_', ''); const location = { id: tagId, tagId, lat: asset.latitude, lon: asset.longitude, timestamp: Date.parse(asset.fixTime || asset.serverTime || '') || Date.now(), isodatetime: asset.fixTime || asset.serverTime || new Date().toISOString(), conf: asset.valid ? 100 : 0, status: asset.status === 'online' ? 1 : 0, address: asset.address || undefined, battery: { level: 0, label: asset.status, color: asset.status === 'online' ? '#10b981' : '#71717a' } } as LocationHistory; setFleetLocations(previous => { const map = new Map(previous.map(item => [item.tagId, item])); map.set(tagId, location); return [...map.values()]; }); };
    void trackingApi.liveMap().then(items => { if (!disposed) items.forEach(mergeAsset); }).catch(() => undefined);
    void trackingApi.websocket().then(ws => { if (disposed) return ws.close(); socket = ws; ws.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === 'position') mergeAsset(message.data); if (message.type === 'remove') setFleetLocations(previous => previous.filter(item => `xadtag_${tags.find(tag => tag.id === item.tagId)?.identifierNormalized}` !== message.id)); } catch { /* ignore */ } }; }).catch(() => undefined);
    return () => { disposed = true; socket?.close(); };
  }, [tags]);

  // 1. Carrega localizações iniciais persistidas no banco (Offline First)
  useEffect(() => {
      if (vehicles.length > 0) {
          const persistedLocations = vehicles
              .filter(v => v.lastPosition && v.tagId)
              .map(v => ({ ...v.lastPosition!, tagId: v.tagId!, id: v.tagId! }));
          
          if (persistedLocations.length > 0) {
              setFleetLocations(prev => {
                  const newMap = new Map(persistedLocations.map(i => [i.tagId, i]));
                  prev.forEach(v => newMap.set(v.tagId, v));
                  return Array.from(newMap.values());
              });
          }
      }
  }, [vehicles]);

  const refreshTag = useCallback(async (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;
    // Um clique manual não deve duplicar a consulta automática em andamento.
    if (refreshingTagIdsRef.current.has(tagId)) return;
    refreshingTagIdsRef.current.add(tagId);
    
    setLoading(true);
    try {
      const results = await fetchTagsLocationBatch([tag], 1);
      if (results.length > 0) {
        const loc = results[0];
        setFleetLocations(prev => {
          const newMap = new Map(prev.map(i => [i.tagId, i]));
          newMap.set(tagId, { ...loc, id: tagId } as any);
          return Array.from(newMap.values());
        });

        // Persiste se for veículo
        const vehicle = vehicles.find(v => v.tagId === tagId);
        if (vehicle) {
          storage.updateVehiclePosition(vehicle.id, loc as any);
          lastSaveRef.current[tagId] = Date.now();
        }
      }
    } finally {
      setLoading(false);
      refreshingTagIdsRef.current.delete(tagId);
    }
  }, [tags, vehicles]);

  const fetchUpdate = async () => {
    if (tags.length === 0) return;
    setLoading(true);
    
    try {
      // Filtra quais tags devem ser consultadas
      const tagsToTrack = tags.filter(t => {
          const isLinked = vehicles.some(v => v.tagId === t.id);
          const isSelected = t.id === selectedTagId;
          const isXadTag = t.type === 'XADTAG';
          return isLinked || isSelected || isXadTag;
      });

      // BUSCA EM LOTE (BATCHING)
      // Usando o valor padrão (3) para evitar erros 429 (Rate Limit)
      const valid = await fetchTagsLocationBatch(tagsToTrack);
      
      // PERSISTÊNCIA INTELIGENTE (Smart Save)
      const now = Date.now();
      valid.forEach(loc => {
          const vehicle = vehicles.find(v => v.tagId === loc.tagId);
          if (vehicle) {
              const lastSaveTime = lastSaveRef.current[loc.tagId!] || 0;
              if ((now - lastSaveTime) > 600000) {
                  storage.updateVehiclePosition(vehicle.id, loc as any);
                  lastSaveRef.current[loc.tagId!] = now;
              }
          }
      });

      // Merge com localizações existentes
      setFleetLocations(prev => {
          const newMap = new Map(prev.map(i => [i.tagId, i]));
          valid.forEach(v => {
              if (v.tagId) {
                  newMap.set(v.tagId, { ...v, id: v.tagId } as any);
              }
          });
          return Array.from(newMap.values());
      });
      
    } finally { setLoading(false); }
  };

  // Atualiza a tag aberta imediatamente e mantém a posição recente enquanto a
  // ficha estiver visível. A frota inteira continua dependendo do realtime/
  // worker para não sobrecarregar a API K-TAG.
  useEffect(() => {
    if (!selectedTagId) return;
    void refreshTag(selectedTagId);
    const interval = window.setInterval(() => void refreshTag(selectedTagId), 60_000);
    return () => window.clearInterval(interval);
  }, [selectedTagId, refreshTag]);

  const injectLocations = (locs: LocationHistory[]) => {
    setFleetLocations(prev => {
      const newMap = new Map(prev.map(i => [i.tagId, i]));
      locs.forEach(v => {
        if (v.tagId) newMap.set(v.tagId, { ...v, id: v.tagId } as LocationHistory);
      });
      return Array.from(newMap.values());
    });
  };

  return { fleetLocations, loading, manualRefresh: fetchUpdate, refreshTag, injectLocations };
};
