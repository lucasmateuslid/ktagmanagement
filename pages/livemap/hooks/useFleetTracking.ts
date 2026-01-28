
import { useState, useEffect, useRef } from 'react';
import { fetchTagLocation } from '../../../services/api';
import { Tag, Vehicle, LocationHistory } from '../../../types';

export const useFleetTracking = (tags: Tag[], vehicles: Vehicle[], selectedTagId: string) => {
  const [fleetLocations, setFleetLocations] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<number | null>(null);

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
      
      // Merge com localizações existentes para não piscar
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
