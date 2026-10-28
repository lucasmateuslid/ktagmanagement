import { useState, useCallback, useEffect, useRef } from 'react';
import { storage } from '../../../services/storage';
import { Vehicle, Tag, Company, VehicleCategory, Client, User } from '../../../types';
import { authenticatedFetch } from '../../../services/authenticatedFetch';

interface VehicleQuery { search?: string; status?: string; companyId?: string; ownershipStatus?: string; installationType?: string; tag?: string }
interface VehiclePage { items: Vehicle[]; nextCursor: string | null }
const PAGE_SIZE = 50;
export const useVehiclesData = (currentUser: User | null, filters: VehicleQuery) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [companies, setCompanies] = useState<Company[]>([]); const [categories, setCategories] = useState<VehicleCategory[]>([]); const [clients, setClients] = useState<Client[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const requestRef = useRef<AbortController | null>(null);
  const queryCacheRef = useRef(new Map<string, { expiresAt: number; page: VehiclePage }>());
  const [auxiliaryRevision, setAuxiliaryRevision] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null); const [cursor, setCursor] = useState<string | null>(null);
  // Pilha de cursores das páginas anteriores: permite voltar numa paginação só-para-frente.
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
  const rawFilterKey = JSON.stringify(filters); const [filterKey, setFilterKey] = useState(rawFilterKey);
  useEffect(() => { const timer = window.setTimeout(() => setFilterKey(rawFilterKey), 350); return () => window.clearTimeout(timer); }, [rawFilterKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mudar filtros invalida os cursores assinados do backend
    setCursor(null);
    setCursorHistory([]);
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
      setVehicles(previous => {
        // Enquanto documentos antigos aguardam o backfill, não deixa uma
        // resposta remota vazia apagar um resultado local já visível.
        const searching = Boolean(activeFilters.search?.trim());
        return searching && incoming.length === 0 ? previous : incoming;
      }); setNextCursor(payload.data.nextCursor);
    } catch (failure) { if ((failure as Error).name !== 'AbortError') setError((failure as Error).message || 'Não foi possível consultar os veículos agora.'); }
    finally { if (requestRef.current === controller) setLoading(false); }
  }, [currentUser, cursor, filterKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado por este hook
    void loadData();
  }, [loadData]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const nextPage = () => { if (!nextCursor || loading) return; setCursorHistory(history => [...history, cursor]); setCursor(nextCursor); };
  const previousPage = () => { if (cursorHistory.length === 0 || loading) return; setCursor(cursorHistory[cursorHistory.length - 1]); setCursorHistory(history => history.slice(0, -1)); };
  const firstPage = () => { if (cursorHistory.length === 0) return; setCursor(null); setCursorHistory([]); };
  const reload = useCallback(() => { queryCacheRef.current.clear(); setAuxiliaryRevision(value => value + 1); void loadData(); }, [loadData]);
  const removeVehicle = useCallback((id: string) => {
    setVehicles(previous => previous.filter(vehicle => vehicle.id !== id));
  }, []);
  const searching = rawFilterKey !== filterKey || loading;
  return {
    vehicles, tags, companies, categories, clients, loading, searching, error, reload, removeVehicle,
    page: cursorHistory.length + 1, pageSize: PAGE_SIZE, hasMore: Boolean(nextCursor), nextPage, previousPage, firstPage,
  };
};
