import { useState, useCallback, useEffect, useRef } from 'react';
import { storage } from '../../../services/storage';
import { Vehicle, Tag, Company, VehicleCategory, Client, User } from '../../../types';
import { authenticatedFetch } from '../../../services/authenticatedFetch';

interface VehicleQuery { search?: string; status?: string; companyId?: string; ownershipStatus?: string; installationType?: string; tag?: string }
interface VehiclePage { items: Vehicle[]; nextCursor: string | null }
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
export const useVehiclesData = (currentUser: User | null, filters: VehicleQuery) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [companies, setCompanies] = useState<Company[]>([]); const [categories, setCategories] = useState<VehicleCategory[]>([]); const [clients, setClients] = useState<Client[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const requestRef = useRef<AbortController | null>(null);
  const queryCacheRef = useRef(new Map<string, { expiresAt: number; page: VehiclePage }>());
  const [auxiliaryRevision, setAuxiliaryRevision] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const rawFilterKey = JSON.stringify(filters); const [filterKey, setFilterKey] = useState(rawFilterKey);
  useEffect(() => { const timer = window.setTimeout(() => setFilterKey(rawFilterKey), SEARCH_DEBOUNCE_MS); return () => window.clearTimeout(timer); }, [rawFilterKey]);
  // Cursor e histórico ficam atrelados à chave de filtros que os gerou. Quando
  // os filtros mudam, valem automaticamente como página 1 — sem um render
  // intermediário que enviaria o cursor antigo e receberia 400 do backend.
  const [paging, setPaging] = useState<{ key: string; cursor: string | null; history: (string | null)[] }>({ key: filterKey, cursor: null, history: [] });
  const cursor = paging.key === filterKey ? paging.cursor : null;
  // Pilha de cursores das páginas anteriores: permite voltar numa paginação só-para-frente.
  const cursorHistory = paging.key === filterKey ? paging.history : [];

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
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), ...(cursor ? { cursor } : {}) });
      const activeFilters = JSON.parse(filterKey) as VehicleQuery;
      Object.entries(activeFilters).forEach(([key, value]) => { if (value && value !== 'all') params.set(key, value); });
      const queryKey = params.toString(); const cached = queryCacheRef.current.get(queryKey);
      if (cached && cached.expiresAt > Date.now()) {
        setVehicles(cached.page.items);
        setNextCursor(cached.page.nextCursor); return;
      }
      const response = await authenticatedFetch(`/api/vehicles?${params}`, { signal: controller.signal }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Falha ao carregar frota.');
      if (controller.signal.aborted) return;
      const incoming: Vehicle[] = payload.data.items || [];
      queryCacheRef.current.set(queryKey, { expiresAt: Date.now() + 30_000, page: { items: incoming, nextCursor: payload.data.nextCursor || null } });
      setVehicles(incoming); setNextCursor(payload.data.nextCursor || null);
    } catch (failure) { if ((failure as Error).name !== 'AbortError') setError((failure as Error).message || 'Não foi possível consultar os veículos agora.'); }
    finally { if (requestRef.current === controller) setLoading(false); }
  }, [currentUser, cursor, filterKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado por este hook
    void loadData();
  }, [loadData]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const nextPage = () => { if (!nextCursor || loading) return; setPaging({ key: filterKey, cursor: nextCursor, history: [...cursorHistory, cursor] }); };
  const previousPage = () => { if (cursorHistory.length === 0 || loading) return; setPaging({ key: filterKey, cursor: cursorHistory[cursorHistory.length - 1], history: cursorHistory.slice(0, -1) }); };
  const firstPage = () => { if (cursorHistory.length === 0) return; setPaging({ key: filterKey, cursor: null, history: [] }); };
  const reload = useCallback(() => { queryCacheRef.current.clear(); setAuxiliaryRevision(value => value + 1); void loadData(); }, [loadData]);
  const removeVehicle = useCallback((id: string) => {
    setVehicles(previous => previous.filter(vehicle => vehicle.id !== id));
  }, []);
  const debouncing = rawFilterKey !== filterKey; const searching = debouncing || loading;
  return {
    vehicles, tags, companies, categories, clients, loading, searching, debouncing, error, reload, removeVehicle,
    page: cursorHistory.length + 1, pageSize: PAGE_SIZE, hasMore: Boolean(nextCursor), nextPage, previousPage, firstPage,
  };
};
