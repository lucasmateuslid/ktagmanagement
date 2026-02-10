
import { useState, useEffect, useRef } from 'react';
import { fetchTagLocation } from '../../../services/api';
import { Tag, Vehicle, LocationHistory } from '../../../types';
import { storage } from '../../../services/storage';

export const useFleetTracking = (tags: Tag[], vehicles: Vehicle[], selectedTagId: string) => {
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);
  
  // Controle de última gravação no banco para economizar writes (Throttling)
  const lastSaveRef = useRef<Record<string, number>>({});

  // 1. Carrega localizações iniciais persistidas no banco (Offline First)
  useEffect(() => {
      if (vehicles.length > 0) {
          const persistedLocations = vehicles
              .filter(v => v.lastPosition && v.tagId)
              .map(v => ({ ...v.lastPosition!, tagId: v.tagId! }));
          
          if (persistedLocations.length > 0) {
              setFleetLocations(prev => {
                  // Merge inicial para não sobrescrever nada que já tenha vindo da API
                  const newMap = new Map(persistedLocations.map(i => [i.tagId, i]));
                  prev.forEach(v => newMap.set(v.tagId, v));
                  return Array.from(newMap.values());
              });
          }
      }
  }, [vehicles]);

  const fetchUpdate = async () => {
    if (tags.length === 0) return;
    setLoading(true);
    
    try {
      // Filtra quais tags devem ser consultadas
      const tagsToTrack = tags.filter(t => {
          // 1. Sempre rastrear tags vinculadas a veículos
          const isLinked = vehicles.some(v => v.tagId === t.id);
          // 2. Rastrear tag solta APENAS se ela estiver selecionada no momento
          const isSelected = t.id === selectedTagId;
          
          return isLinked || isSelected;
      });

      const results = await Promise.all(tagsToTrack.map(async (tag) => {
         try {
           const res = await fetchTagLocation(tag);
           // FIX: Use tag.id as the stable key for the map marker
           return res.length > 0 ? { ...res[0], tagId: tag.id, id: tag.id } as LocationHistory : null;
         } catch(e) { return null; }
      }));
      
      const valid = results.filter((r): r is LocationHistory => r !== null);
      
      // PERSISTÊNCIA INTELIGENTE (Smart Save)
      // Só salva no banco se: 
      // 1. Veículo vinculado
      // 2. Passou 10 minutos desde o último save OU
      // 3. Moveu significativamente (Opcional, aqui faremos por tempo para simplificar)
      const now = Date.now();
      valid.forEach(loc => {
          const vehicle = vehicles.find(v => v.tagId === loc.tagId);
          if (vehicle) {
              const lastSaveTime = lastSaveRef.current[loc.tagId] || 0;
              // Salva a cada 10 minutos (600000ms) para não estourar cota do Firestore
              if ((now - lastSaveTime) > 600000) {
                  storage.updateVehiclePosition(vehicle.id, loc);
                  lastSaveRef.current[loc.tagId] = now;
              }
          }
      });

      // Merge com localizações existentes para não piscar e manter os offline visíveis
      setFleetLocations(prev => {
          const newMap = new Map(prev.map(i => [i.tagId, i]));
          valid.forEach(v => newMap.set(v.tagId, v));
          return Array.from(newMap.values());
      });
      
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchUpdate();
    timerRef.current = window.setInterval(fetchUpdate, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [selectedTagId, tags, vehicles]);

  // Force immediate update when selecting a tag
  useEffect(() => {
      if (selectedTagId) setTimeout(fetchUpdate, 100);
  }, [selectedTagId]);

  return { fleetLocations, loading, manualRefresh: fetchUpdate };
};