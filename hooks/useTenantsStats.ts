/**
 * Carrega o resultado da Cloud Function aggregateTenantsStats e expõe loading/erro.
 * Pode ser disparado novamente via `refresh()`.
 */
import { useCallback, useEffect, useState } from 'react';
import { adminApi, type TenantsStatsResponse } from '../services/adminApi';

interface UseTenantsStatsResult {
  stats: TenantsStatsResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTenantsStats(autoLoad = true): UseTenantsStatsResult {
  const [stats, setStats] = useState<TenantsStatsResponse | null>(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.aggregateTenantsStats();
      setStats(data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar estatísticas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) void refresh();
  }, [autoLoad, refresh]);

  return { stats, loading, error, refresh };
}
