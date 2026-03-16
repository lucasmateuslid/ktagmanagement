/**
 * useTraccar.ts — Hook para consumir dados do Traccar via BFF
 *
 * Uso:
 *   const { devices, positions, loading, error } = useTraccar();
 *   const { history } = useTraccarHistory(deviceId, from, to);
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API = import.meta.env.VITE_BACKEND_API_URL ?? '';
const TOKEN = localStorage.getItem('session_token') ?? '';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// ─────────────────────────────────────────
// Tipos (espelham backend/src/services/traccar.ts)
// ─────────────────────────────────────────

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  lastUpdate: string;
  positionId: number;
  groupId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  serverTime: string;
  fixTime: string;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address: string;
  attributes: {
    ignition?: boolean;
    motion?: boolean;
    batteryLevel?: number;
    [key: string]: unknown;
  };
}

// ─────────────────────────────────────────
// Hook principal — dispositivos + posições ao vivo
// Faz polling a cada `intervalMs` (padrão: 30s)
// ─────────────────────────────────────────

export function useTraccar(intervalMs = 30_000) {
  const [devices, setDevices]     = useState<TraccarDevice[]>([]);
  const [positions, setPositions] = useState<TraccarPosition[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [devRes, posRes] = await Promise.all([
        fetch(`${API}/api/traccar/devices`,   { headers }),
        fetch(`${API}/api/traccar/positions`, { headers }),
      ]);

      if (!devRes.ok || !posRes.ok) throw new Error('Erro ao buscar dados do Traccar');

      const [devData, posData] = await Promise.all([devRes.json(), posRes.json()]);
      setDevices(devData);
      setPositions(posData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, intervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll, intervalMs]);

  return { devices, positions, loading, error, refresh: fetchAll };
}

// ─────────────────────────────────────────
// Hook de histórico — busca rota de um dispositivo
// ─────────────────────────────────────────

export function useTraccarHistory(
  deviceId: number | null,
  from: Date | null,
  to: Date | null,
) {
  const [history, setHistory]   = useState<TraccarPosition[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId || !from || !to) return;

    setLoading(true);
    const params = new URLSearchParams({
      deviceId: String(deviceId),
      from: from.toISOString(),
      to: to.toISOString(),
    });

    fetch(`${API}/api/traccar/positions/history?${params}`, { headers })
      .then(r => { if (!r.ok) throw new Error('Erro ao buscar histórico'); return r.json(); })
      .then(data => { setHistory(data); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [deviceId, from?.toISOString(), to?.toISOString()]);

  return { history, loading, error };
}
