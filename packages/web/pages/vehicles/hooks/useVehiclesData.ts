import { useState, useCallback, useEffect, useRef } from 'react';
import { storage } from '../../../services/storage';
import { Vehicle, Tag, Company, VehicleCategory, Client, User } from '../../../types';
import { authenticatedFetch } from '../../../services/authenticatedFetch';

interface VehicleQuery { search?: string; status?: string; companyId?: string; ownershipStatus?: string; installationType?: string; tag?: string }
export const useVehiclesData = (currentUser: User | null, filters: VehicleQuery) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [companies, setCompanies] = useState<Company[]>([]); const [categories, setCategories] = useState<VehicleCategory[]>([]); const [clients, setClients] = useState<Client[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const requestRef = useRef<AbortController | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null); const [cursor, setCursor] = useState<string | null>(null);
  const rawFilterKey = JSON.stringify(filters); const [filterKey, setFilterKey] = useState(rawFilterKey);
  useEffect(() => { const timer = window.setTimeout(() => setFilterKey(rawFilterKey), 350); return () => window.clearTimeout(timer); }, [rawFilterKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mudar filtros invalida os cursores assinados do backend
    setCursor(null); setVehicles([]);
  }, [filterKey]);
  const loadData = useCallback(async () => {
    if (!currentUser) return; requestRef.current?.abort(); const controller = new AbortController(); requestRef.current = controller; setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ limit: '50', ...(cursor ? { cursor } : {}) });
      const activeFilters = JSON.parse(filterKey) as VehicleQuery;
      Object.entries(activeFilters).forEach(([key, value]) => { if (value && value !== 'all') params.set(key, value); });
      const response = await authenticatedFetch(`/api/vehicles?${params}`, { signal: controller.signal }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Falha ao carregar frota.');
      if (controller.signal.aborted) return;
      const incoming: Vehicle[] = payload.data.items || [];
      setVehicles(previous => cursor ? [...new Map([...previous, ...incoming].map(item => [item.id, item])).values()] : incoming); setNextCursor(payload.data.nextCursor);
      const clientFleet = currentUser.role === 'client' ? await authenticatedFetch('/api/client/fleet').then(async result => {
        const body = await result.json(); if (!result.ok) throw new Error(body.error || 'Falha ao carregar dados auxiliares da frota.'); return body.data;
      }) : null;
      const [allTags, allCategories, allCompanies, allClients] = await Promise.all(currentUser.role === 'client'
        ? [Promise.resolve(clientFleet?.tags || []), Promise.resolve(clientFleet?.categories || []), Promise.resolve([]), Promise.resolve([])]
        : [storage.getTags(), storage.getCategories(), storage.getCompanies(), storage.getClients()]);
      setTags(allTags); setCategories(allCategories); setCompanies(allCompanies); setClients(allClients);
    } catch (failure) { if ((failure as Error).name !== 'AbortError') setError((failure as Error).message || 'Falha ao carregar frota.'); }
    finally { if (requestRef.current === controller) setLoading(false); }
  }, [currentUser, cursor, filterKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado por este hook
    void loadData();
  }, [loadData]);
  const loadMore = () => { if (nextCursor && !loading) setCursor(nextCursor); };
  const removeVehicle = useCallback((id: string) => {
    setVehicles(previous => previous.filter(vehicle => vehicle.id !== id));
  }, []);
  return { vehicles, tags, companies, categories, clients, loading, error, reload: loadData, removeVehicle, loadMore, hasMore: Boolean(nextCursor) };
};
