import { useState, useCallback, useEffect, useRef } from 'react';
import type { TrackingHistoryPage } from '@ktag/shared';
import type { LocationHistory } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { trackingApi } from '../../../services/trackingApi';
import { mergeHistoryLocations, trackingPointToLocation } from '../utils/historyPoints';

export const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
export type HistoryPeriod = { from: string; to: string };

export const useVehicleHistory = (vehicleId: string, selectedTagId: string, currentFleetLocations: LocationHistory[], onResolveAddresses: (items: LocationHistory[]) => void) => {
  const [historyItems, setHistoryItems] = useState<LocationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyPartial, setHistoryPartial] = useState(false);
  const [historyWarnings, setHistoryWarnings] = useState<string[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<HistoryPeriod | null>(null);
  const { addNotification } = useNotification();
  const requestRef = useRef<{ id: number; controller?: AbortController }>({ id: 0 });
  const periodRef = useRef<HistoryPeriod | null>(null);

  useEffect(() => () => requestRef.current.controller?.abort(), []);

  const load = useCallback(async (period?: HistoryPeriod, cursor?: string, append = false) => {
    if (!vehicleId || !selectedTagId) { addNotification('info', 'Histórico indisponível', 'Selecione um veículo com equipamento vinculado.'); return; }
    requestRef.current.controller?.abort();
    const controller = new AbortController(); const requestId = requestRef.current.id + 1;
    requestRef.current = { id: requestId, controller };
    if (!append) { setHistoryItems([]); setNextCursor(null); setHistoryError(null); }
    setHistoryLoading(true); setShowHistoryList(true);
    try {
      const end = Date.now();
      const range = period || (append ? periodRef.current : null) || { from: new Date(end - HISTORY_WINDOW_MS).toISOString(), to: new Date(end).toISOString() };
      if (!append) { periodRef.current = range; setActivePeriod(range); }
      const response: TrackingHistoryPage = await trackingApi.vehicleHistory(vehicleId, range.from, range.to, cursor, controller.signal);
      const results = response.points.map(trackingPointToLocation);
      if (!append) {
        // Histórico e posição atual têm contratos separados: somente pontos
        // retornados pela consulta de histórico entram na trajetória.
      }
      if (requestRef.current.id === requestId) {
        setHistoryItems(previous => mergeHistoryLocations(append ? [...previous, ...results] : results));
        setNextCursor(response.nextCursor); setHistoryPartial(response.partial); setHistoryWarnings(response.warnings.map(item => item.message));
        onResolveAddresses(results.slice(0, 3));
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError' && requestRef.current.id === requestId) {
        const message = (error as Error).message || 'Falha ao recuperar trajetória.';
        setHistoryError(message);
        addNotification('error', 'Erro', message);
      }
    } finally { if (requestRef.current.id === requestId) setHistoryLoading(false); }
  }, [vehicleId, selectedTagId, currentFleetLocations, addNotification, onResolveAddresses]);

  const fetchHistory = useCallback((period?: HistoryPeriod) => load(period), [load]);
  const loadMoreHistory = useCallback(() => { if (nextCursor) void load(periodRef.current || undefined, nextCursor, true); }, [load, nextCursor]);
  const closeHistory = useCallback(() => { requestRef.current.controller?.abort(); requestRef.current = { id: requestRef.current.id + 1 }; setHistoryLoading(false); setShowHistoryList(false); }, []);
  return { historyItems, historyLoading, showHistoryList, fetchHistory, closeHistory, setShowHistoryList, nextCursor, loadMoreHistory, historyPartial, historyWarnings, historyError, activePeriod };
};
