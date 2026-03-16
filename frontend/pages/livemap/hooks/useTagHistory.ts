
import { useState, useCallback } from 'react';
import { Tag, LocationHistory } from '../../../types';
import { xadtagService } from '../../../services/xadtag';
import { useNotification } from '../../../contexts/NotificationContext';

export const useTagHistory = (
    selectedTagId: string, 
    tags: Tag[], 
    currentFleetLocations: LocationHistory[],
    onResolveAddresses: (items: LocationHistory[]) => void
) => {
  const [historyItems, setHistoryItems] = useState<LocationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const { addNotification } = useNotification();

  const fetchHistory = useCallback(async () => {
    if (!selectedTagId) return;
    const tag = tags.find(t => t.id === selectedTagId);
    if (!tag) return;

    setHistoryLoading(true);
    setShowHistoryList(true);
    
    try {
        const endTime = Date.now();
        const startTime = endTime - (24 * 60 * 60 * 1000); // Últimas 24h
        
        let results: LocationHistory[] = [];
        if (tag.type === 'XADTAG') {
            const rawResults = await xadtagService.fetchHistory(tag, startTime, endTime);
            results = rawResults.map((p, idx) => ({ 
              ...p, 
              id: `${tag.id}-hist-${idx}`, 
              tagId: tag.id 
            })) as LocationHistory[];
        } else {
            // Mock para K-TAG se não houver backend real de histórico
            const last = currentFleetLocations.find(l => l.tagId === selectedTagId);
            if (last) {
                // Simula alguns pontos anteriores
                results = [last];
                for(let i=1; i<=10; i++) {
                    results.push({ 
                        ...last, 
                        lat: last.lat + (Math.random() * 0.002 - 0.001), 
                        lon: last.lon + (Math.random() * 0.002 - 0.001), 
                        timestamp: last.timestamp - (i * 3600000), // -1 hora cada
                        id: `hist-${i}` 
                    });
                }
            }
        }
        
        // Resolve endereços dos 3 primeiros
        const top3 = results.slice(0, 3);
        onResolveAddresses(top3);

        setHistoryItems(results);
    } catch (e) {
        addNotification('error', 'Erro', 'Falha ao recuperar trajetória.');
    } finally {
        setHistoryLoading(false);
    }
  }, [selectedTagId, tags, currentFleetLocations, onResolveAddresses, addNotification]);

  const closeHistory = () => setShowHistoryList(false);

  return { historyItems, historyLoading, showHistoryList, fetchHistory, closeHistory, setShowHistoryList };
};
