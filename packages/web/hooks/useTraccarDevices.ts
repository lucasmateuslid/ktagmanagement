import { useState, useEffect, useCallback } from 'react';
import type { TraccarDevice } from '@ktag/shared';

interface ApiResult<T> {
  data: T;
  ok: true;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const json = await res.json() as ApiResult<T>;
  return json.data;
}

export function useTraccarDevices() {
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TraccarDevice[]>('/api/tracking/devices');
      setDevices(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createDevice = async (name: string, uniqueId: string, model?: string) => {
    const device = await apiFetch<TraccarDevice>('/api/tracking/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, uniqueId, model }),
    });
    setDevices(prev => [...prev, device]);
    return device;
  };

  const deleteDevice = async (id: number) => {
    await apiFetch<void>(`/api/tracking/devices/${id}`, { method: 'DELETE' });
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  return { devices, loading, error, reload: load, createDevice, deleteDevice };
}
