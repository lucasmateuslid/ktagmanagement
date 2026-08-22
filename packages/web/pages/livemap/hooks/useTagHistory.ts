import { useState, useCallback, useRef } from 'react';
import type { TrackingHistoryPage, TrackingHistoryPoint } from '@ktag/shared';
import { Tag, LocationHistory, Vehicle } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { trackingApi } from '../../../services/trackingApi';

const toLocation = (point: TrackingHistoryPoint): LocationHistory => ({
  id: point.id, tagId: point.tagId, lat: point.latitude, lon: point.longitude,
  timestamp: point.timestamp, isodatetime: new Date(point.timestamp).toISOString(),
  conf: point.accuracy ?? 100, status: 1, address: point.address || undefined,
  battery: typeof point.battery === 'object' ? point.battery as any : undefined,
});

export const useTagHistory = (selectedTagId: string, tags: Tag[], vehicles: Vehicle[], currentFleetLocations: LocationHistory[], onResolveAddresses: (items: LocationHistory[]) => void) => {
  const [historyItems, setHistoryItems] = useState<LocationHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [historyDays, setHistoryDays] = useState<1 | 7 | 30>(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyPartial, setHistoryPartial] = useState(false);
  const [historyWarnings, setHistoryWarnings] = useState<string[]>([]);
  const { addNotification } = useNotification();
  const requestRef = useRef<{ id: number; controller?: AbortController }>({ id: 0 });

  const load = useCallback(async (days: 1 | 7 | 30, cursor?: string, append = false) => {
    if (!selectedTagId || !tags.some(tag => tag.id === selectedTagId)) return;
    const vehicle = vehicles.find(item => item.tagId === selectedTagId);
    requestRef.current.controller?.abort();
    const controller = new AbortController(); const requestId = requestRef.current.id + 1;
    requestRef.current = { id: requestId, controller };
    setHistoryLoading(true); setShowHistoryList(true);
    try {
      const end = Date.now(); const start = end - days * 86_400_000;
      const response: TrackingHistoryPage = vehicle
        ? await trackingApi.vehicleHistory(vehicle.id, new Date(start).toISOString(), new Date(end).toISOString(), cursor, controller.signal)
        : await trackingApi.tagHistory(selectedTagId, new Date(start).toISOString(), new Date(end).toISOString(), cursor, controller.signal);
      let results = response.points.map(toLocation);
      if (!append) {
        const last = currentFleetLocations.find(item => item.tagId === selectedTagId);
        if (last && !results.some(item => item.id === last.id || (item.timestamp === last.timestamp && item.lat === last.lat && item.lon === last.lon))) results.unshift(last);
      }
      onResolveAddresses(results);
      if (requestRef.current.id === requestId) {
        setHistoryItems(previous => {
          const values = append ? [...previous, ...results] : results;
          return [...new Map(values.map(item => [`${item.id}|${item.timestamp}`, item])).values()].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
        });
        setNextCursor(response.nextCursor); setHistoryPartial(response.partial); setHistoryWarnings(response.warnings.map(item => item.message));
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') addNotification('error', 'Erro', (error as Error).message || 'Falha ao recuperar trajetória.');
    } finally { if (requestRef.current.id === requestId) setHistoryLoading(false); }
  }, [selectedTagId, tags, vehicles, currentFleetLocations, onResolveAddresses, addNotification]);

  const fetchHistory = useCallback(() => load(historyDays), [load, historyDays]);
  const changeHistoryDays = useCallback((days: 1 | 7 | 30) => { setHistoryDays(days); void load(days); }, [load]);
  const loadMoreHistory = useCallback(() => { if (nextCursor) void load(historyDays, nextCursor, true); }, [load, historyDays, nextCursor]);
  const closeHistory = () => { requestRef.current.controller?.abort(); setShowHistoryList(false); };

  return { historyItems, historyLoading, showHistoryList, fetchHistory, closeHistory, setShowHistoryList, historyDays, changeHistoryDays, nextCursor, loadMoreHistory, historyPartial, historyWarnings };
};
