import { useState, useCallback, useEffect } from 'react';
import { storage } from '../../../services/storage';
import { Vehicle, Tag, Company, VehicleCategory, Client, User } from '../../../types';
import { authenticatedFetch } from '../../../services/authenticatedFetch';

interface VehicleQuery { search?: string; status?: string; companyId?: string; ownershipStatus?: string; installationType?: string; tag?: string }
export const useVehiclesData = (currentUser: User | null, filters: VehicleQuery) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [companies, setCompanies] = useState<Company[]>([]); const [categories, setCategories] = useState<VehicleCategory[]>([]); const [clients, setClients] = useState<Client[]>([]); const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null); const [previousCursor, setPreviousCursor] = useState<string | null>(null); const [cursor, setCursor] = useState<string | null>(null); const [direction, setDirection] = useState<'next'|'previous'>('next');
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mudar filtros invalida os cursores assinados do backend
    setCursor(null); setDirection('next');
  }, [filterKey]);
  const loadData = useCallback(async () => {
    if (!currentUser) return; setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', ...(cursor ? { cursor, direction } : {}) });
      const activeFilters = JSON.parse(filterKey) as VehicleQuery;
      Object.entries(activeFilters).forEach(([key, value]) => { if (value && value !== 'all') params.set(key, value); });
      const response = await authenticatedFetch(`/api/vehicles?${params}`); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Falha ao carregar frota.');
      setVehicles(payload.data.items || []); setNextCursor(payload.data.nextCursor); setPreviousCursor(payload.data.previousCursor);
      const clientFleet = currentUser.role === 'client' ? await authenticatedFetch('/api/client/fleet').then(async result => {
        const body = await result.json(); if (!result.ok) throw new Error(body.error || 'Falha ao carregar dados auxiliares da frota.'); return body.data;
      }) : null;
      const [allTags, allCategories, allCompanies, allClients] = await Promise.all(currentUser.role === 'client'
        ? [Promise.resolve(clientFleet?.tags || []), Promise.resolve(clientFleet?.categories || []), Promise.resolve([]), Promise.resolve([])]
        : [storage.getTags(), storage.getCategories(), storage.getCompanies(), storage.getClients()]);
      setTags(allTags); setCategories(allCategories); setCompanies(allCompanies); setClients(allClients);
    } finally { setLoading(false); }
  }, [currentUser, cursor, direction, filterKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado por este hook
    void loadData();
  }, [loadData]);
  const nextPage = () => { if (nextCursor) { setDirection('next'); setCursor(nextCursor); } };
  const previousPage = () => { if (previousCursor) { setDirection('previous'); setCursor(previousCursor); } };
  return { vehicles, tags, companies, categories, clients, loading, reload: loadData, nextPage, previousPage, hasNextPage: Boolean(nextCursor), hasPreviousPage: Boolean(previousCursor) };
};
