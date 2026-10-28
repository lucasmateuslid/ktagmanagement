import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '../../../services/authenticatedFetch';
import { Vehicle } from '../../../types';

export interface VehicleSummary { total: number; withTag: number; withoutTag: number }

/** Totais da frota (endpoint de agregação) + amostra de veículos sem tag para revisão. */
export function useVehicleSummary(enabled: boolean) {
  const [summary, setSummary] = useState<VehicleSummary | null>(null);
  const [untagged, setUntagged] = useState<Vehicle[]>([]);

  const reload = useCallback(async () => {
    try {
      const [summaryResponse, untaggedResponse] = await Promise.all([
        authenticatedFetch('/api/vehicles/summary'),
        authenticatedFetch('/api/vehicles?tag=unlinked&limit=20'),
      ]);
      const summaryPayload = await summaryResponse.json();
      const untaggedPayload = await untaggedResponse.json();
      if (summaryResponse.ok) setSummary(summaryPayload.data);
      if (untaggedResponse.ok) setUntagged(untaggedPayload.data?.items || []);
    } catch {
      // Resumo é informativo: falha não bloqueia a lista.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado
    void reload();
  }, [enabled, reload]);

  return { summary, untagged, reload };
}
