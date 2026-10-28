import { useCallback, useEffect, useState } from 'react';
import { storage } from '../../../services/storage';
import { Client, Vehicle } from '../../../types';

/** Carrega clientes e veículos uma vez e expõe `reload` para depois de gravações. */
export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, v] = await Promise.all([storage.getClients(), storage.getVehicles()]);
      setClients(c || []);
      setVehicles(v || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado por este hook
  useEffect(() => { void reload(); }, [reload]);

  return { clients, vehicles, loading, error, reload };
}
