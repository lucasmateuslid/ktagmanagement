import { useState, useCallback, useEffect, useRef } from 'react';
import { storage } from '../../../services/storage';
import { Vehicle, Tag, Company, VehicleCategory, Client, User } from '../../../types';
import { authenticatedFetch } from '../../../services/authenticatedFetch';

interface VehicleQuery { search?: string; status?: string; companyId?: string; ownershipStatus?: string; installationType?: string; tag?: string }
export const useVehiclesData = (currentUser: User | null, filters: VehicleQuery) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [companies, setCompanies] = useState<Company[]>([]); const [categories, setCategories] = useState<VehicleCategory[]>([]); const [clients, setClients] = useState<Client[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const requestRef = useRef<AbortController | null>(null);
  const [auxiliaryRevision, setAuxiliaryRevision] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null); const [cursor, setCursor] = useState<string | null>(null);
  const rawFilterKey = JSON.stringify(filters); const [filterKey, setFilterKey] = useState(rawFilterKey);
  useEffect(() => { const timer = window.setTimeout(() => setFilterKey(rawFilterKey), 350); return () => window.clearTimeout(timer); }, [rawFilterKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mudar filtros invalida os cursores assinados do backend
    setCursor(null);
  }, [filterKey]);

  // Os dados auxiliares não dependem da pesquisa. Mantê-los em um efeito
  // separado evita quatro leituras completas do Firestore a cada debounce.
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const loadAuxiliaryData = async () => {
      try {
        if (currentUser.role === 'client') {
          const response = await authenticatedFetch('/api/client/fleet'); const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Falha ao carregar dados auxiliares da frota.');
          if (active) { setTags(payload.data.tags || []); setCategories(payload.data.categories || []); setCompanies([]); setClients([]); }
          return;
        }
        const [allTags, allCategories, allCompanies, allClients] = await Promise.all([
          storage.getTags(), storage.getCategories(), storage.getCompanies(), storage.getClients(),
        ]);
        if (active) { setTags(allTags); setCategories(allCategories); setCompanies(allCompanies); setClients(allClients); }
      } catch (failure) {
        if (active) setError((failure as Error).message || 'Falha ao carregar dados auxiliares da frota.');
      }
    };
    void loadAuxiliaryData();
    return () => { active = false; };
  }, [currentUser, auxiliaryRevision]);

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
    } catch (failure) { if ((failure as Error).name !== 'AbortError') setError((failure as Error).message || 'Falha ao carregar frota.'); }
    finally { if (requestRef.current === controller) setLoading(false); }
  }, [currentUser, cursor, filterKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado por este hook
    void loadData();
  }, [loadData]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const loadMore = () => { if (nextCursor && !loading) setCursor(nextCursor); };
  const reload = useCallback(() => { setAuxiliaryRevision(value => value + 1); void loadData(); }, [loadData]);
  const removeVehicle = useCallback((id: string) => {
    setVehicles(previous => previous.filter(vehicle => vehicle.id !== id));
  }, []);
  const searching = rawFilterKey !== filterKey || loading;
  return { vehicles, tags, companies, categories, clients, loading, searching, error, reload, removeVehicle, loadMore, hasMore: Boolean(nextCursor) };
};
