
import { useState, useCallback } from 'react';
import { Tag, LocationHistory, Vehicle } from '../../../types';
import { xadtagService } from '../../../services/xadtag';
import { useNotification } from '../../../contexts/NotificationContext';
import { db } from '../../../services/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

export const useTagHistory = (
    selectedTagId: string, 
    tags: Tag[], 
    vehicles: Vehicle[],
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
            
            // Reordena para ficar cronológico (do mais novo para o mais antigo) - FIM para INICIO
            results.sort((a, b) => b.timestamp - a.timestamp);
        } else {
            // Busca dos históricos persistidos no banco de dados
            const vehicle = vehicles.find(v => v.tagId === selectedTagId);
            if (vehicle && db) {
                const q = query(
                    collection(db, `ktag_vehicles/${vehicle.id}/history`),
                    orderBy('timestamp', 'desc')
                );
                const snapshot = await getDocs(q);
                
                snapshot.forEach(doc => {
                    const data = doc.data() as LocationHistory;
                    // Filtra últimas 24h
                    if (data.timestamp >= startTime) {
                        results.push(data);
                    }
                });
            }

            // Garante que o último ponto atual também seja exibido caso não esteja salvo ainda
            const last = currentFleetLocations.find(l => l.tagId === selectedTagId);
            if (last && !results.some(r => r.timestamp === last.timestamp)) {
                results.unshift(last);
            }
            
            // Reordena do mais novo para o mais antigo
            results.sort((a, b) => b.timestamp - a.timestamp);
        }
        
        // Resolve endereços dos 3 primeiros
        const top3 = results.slice(0, 3);
        onResolveAddresses(top3);

        setHistoryItems(results);
    } catch (e) {
        console.error('Error fetching history:', e);
        addNotification('error', 'Erro', 'Falha ao recuperar trajetória.');
    } finally {
        setHistoryLoading(false);
    }
  }, [selectedTagId, tags, vehicles, currentFleetLocations, onResolveAddresses, addNotification]);

  const closeHistory = () => setShowHistoryList(false);

  return { historyItems, historyLoading, showHistoryList, fetchHistory, closeHistory, setShowHistoryList };
};
