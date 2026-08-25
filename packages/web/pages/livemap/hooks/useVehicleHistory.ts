import { useState, useCallback, useEffect, useRef } from 'react';
import type { TrackingHistoryPage } from '@ktag/shared';
import type { LocationHistory } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { trackingApi } from '../../../services/trackingApi';
import { locationHistoryKey, mergeHistoryLocations, trackingPointToLocation } from '../utils/historyPoints';

export const useVehicleHistory = (vehicleId: string, selectedTagId: string, currentFleetLocations: LocationHistory[], onResolveAddresses: (items: LocationHistory[]) => void) => {
  const [historyItems, setHistoryItems] = useState<LocationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [historyDays, setHistoryDays] = useState<1 | 7 | 30>(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyPartial, setHistoryPartial] = useState(false);
  const [historyWarnings, setHistoryWarnings] = useState<string[]>([]);
  const { addNotification } = useNotification();
  const requestRef = useRef<{ id: number; controller?: AbortController }>({ id: 0 });

  useEffect(() => () => requestRef.current.controller?.abort(), []);

  const load = useCallback(async (days: 1 | 7 | 30, cursor?: string, append = false) => {
    if (!vehicleId || !selectedTagId) { addNotification('info', 'Histórico indisponível', 'Selecione um veículo com equipamento vinculado.'); return; }
    requestRef.current.controller?.abort();
    const controller = new AbortController(); const requestId = requestRef.current.id + 1;
    requestRef.current = { id: requestId, controller }; setHistoryLoading(true); setShowHistoryList(true);
    try {
      const end = Date.now(); const start = end - days * 86_400_000;
      const response: TrackingHistoryPage = await trackingApi.vehicleHistory(vehicleId, new Date(start).toISOString(), new Date(end).toISOString(), cursor, controller.signal);
      const results = response.points.map(trackingPointToLocation);
      if (!append) {
        const current = currentFleetLocations.find(item => item.tagId === selectedTagId);
        if (current && !results.some(item => locationHistoryKey(item) === locationHistoryKey(current))) results.unshift(current);
      }
      if (requestRef.current.id === requestId) {
        setHistoryItems(previous => mergeHistoryLocations(append ? [...previous, ...results] : results));
        setNextCursor(response.nextCursor); setHistoryPartial(response.partial); setHistoryWarnings(response.warnings.map(item => item.message));
        onResolveAddresses(results.slice(0, 3));
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError' && requestRef.current.id === requestId) addNotification('error', 'Erro', (error as Error).message || 'Falha ao recuperar trajetória.');
    } finally { if (requestRef.current.id === requestId) setHistoryLoading(false); }
  }, [vehicleId, selectedTagId, currentFleetLocations, addNotification, onResolveAddresses]);

  const fetchHistory = useCallback(() => load(historyDays), [load, historyDays]);
  const changeHistoryDays = useCallback((days: 1 | 7 | 30) => { setHistoryDays(days); void load(days); }, [load]);
  const loadMoreHistory = useCallback(() => { if (nextCursor) void load(historyDays, nextCursor, true); }, [load, historyDays, nextCursor]);
  const closeHistory = useCallback(() => { requestRef.current.controller?.abort(); requestRef.current = { id: requestRef.current.id + 1 }; setHistoryLoading(false); setShowHistoryList(false); }, []);
  return { historyItems, historyLoading, showHistoryList, fetchHistory, closeHistory, setShowHistoryList, historyDays, changeHistoryDays, nextCursor, loadMoreHistory, historyPartial, historyWarnings };
};
