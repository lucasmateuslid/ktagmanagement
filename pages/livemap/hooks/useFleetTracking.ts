
import { useState, useEffect, useRef } from 'react';
import { fetchTagsLocationBatch } from '../../../services/api';
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

  const refreshTag = async (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) return;
    
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
    }
  };

  const fetchUpdate = async () => {
    if (tags.length === 0) return;
    setLoading(true);
    
    try {
      // Filtra quais tags devem ser consultadas
      const tagsToTrack = tags.filter(t => {
          const isLinked = vehicles.some(v => v.tagId === t.id);
          const isSelected = t.id === selectedTagId;
          return isLinked || isSelected;
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

  useEffect(() => {
    fetchUpdate();
    // Reduzido drasticamente a frequência de atualização automática da frota completa
    // Agora o sistema conta com o Cloud Function atualizando em background a cada 30 min
    timerRef.current = window.setInterval(fetchUpdate, 600000); // 10 minutos para frota toda
    
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tags.length]);

  // Atualização mais frequente apenas para o veículo selecionado
  useEffect(() => {
      if (selectedTagId) {
          const interval = setInterval(() => refreshTag(selectedTagId), 60000); // 1 minuto para o selecionado
          return () => clearInterval(interval);
      }
  }, [selectedTagId]);

  return { fleetLocations, loading, manualRefresh: fetchUpdate, refreshTag };
};