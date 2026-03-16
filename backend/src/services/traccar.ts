/**
 * traccar.ts — Serviço de integração com o Traccar Server
 *
 * O BFF é o único cliente do Traccar. O frontend nunca chama
 * o Traccar diretamente, mantendo credenciais fora do navegador.
 */

import { env } from '../config/env.js';

const getHeaders = () => {
  const basicAuth = Buffer.from(`${env.traccar.user}:${env.traccar.pass}`).toString('base64');
  return {
    'Authorization': `Basic ${basicAuth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
};

// ─────────────────────────────────────────
// Tipos principais (subconjunto da API Traccar)
// ─────────────────────────────────────────

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;   // identificador do hardware (IMEI, serial)
  status: 'online' | 'offline' | 'unknown';
  lastUpdate: string; // ISO 8601
  positionId: number;
  groupId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;      // km/h
  course: number;     // graus (0-360)
  address: string;
  attributes: {
    ignition?: boolean;
    motion?: boolean;
    batteryLevel?: number;
    fuel?: number;
    [key: string]: unknown;
  };
}

export interface TraccarGeofence {
  id: number;
  name: string;
  description: string;
  area: string;       // WKT: CIRCLE(...) ou POLYGON(...)
  calendarId: number;
  attributes: Record<string, unknown>;
}

export interface TraccarEvent {
  id: number;
  deviceId: number;
  type: string;
  eventTime: string;
  positionId: number;
  geofenceId: number;
  maintenanceId: number;
  attributes: Record<string, unknown>;
}

// ─────────────────────────────────────────
// Helper de fetch com tratamento de erro
// ─────────────────────────────────────────

async function traccarFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${env.traccar.url}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options?.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Traccar ${path} → HTTP ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────
// Dispositivos
// ─────────────────────────────────────────

/** Lista todos os dispositivos cadastrados no Traccar */
export const getDevices = (): Promise<TraccarDevice[]> =>
  traccarFetch<TraccarDevice[]>('/api/devices');

/** Busca um dispositivo pelo uniqueId (IMEI/serial do hardware) */
export const getDeviceByUniqueId = (uniqueId: string): Promise<TraccarDevice[]> =>
  traccarFetch<TraccarDevice[]>(`/api/devices?uniqueId=${uniqueId}`);

// ─────────────────────────────────────────
// Posições
// ─────────────────────────────────────────

/** Posição atual de todos os dispositivos (ou de um específico) */
export const getPositions = (deviceId?: number): Promise<TraccarPosition[]> => {
  const qs = deviceId ? `?deviceId=${deviceId}` : '';
  return traccarFetch<TraccarPosition[]>(`/api/positions${qs}`);
};

/** Histórico de posições de um dispositivo num intervalo de tempo */
export const getPositionHistory = (
  deviceId: number,
  from: Date,
  to: Date,
): Promise<TraccarPosition[]> => {
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return traccarFetch<TraccarPosition[]>(`/api/reports/route?${params}`);
};

// ─────────────────────────────────────────
// Geofences
// ─────────────────────────────────────────

export const getGeofences = (): Promise<TraccarGeofence[]> =>
  traccarFetch<TraccarGeofence[]>('/api/geofences');

export const createGeofence = (data: Partial<TraccarGeofence>): Promise<TraccarGeofence> =>
  traccarFetch<TraccarGeofence>('/api/geofences', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteGeofence = (id: number): Promise<void> =>
  traccarFetch<void>(`/api/geofences/${id}`, { method: 'DELETE' });

// ─────────────────────────────────────────
// Eventos
// ─────────────────────────────────────────

export const getEvents = (
  deviceId: number,
  from: Date,
  to: Date,
): Promise<TraccarEvent[]> => {
  const params = new URLSearchParams({
    deviceId: String(deviceId),
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return traccarFetch<TraccarEvent[]>(`/api/reports/events?${params}`);
};

// ─────────────────────────────────────────
// Health check
// ─────────────────────────────────────────

export const getServerInfo = (): Promise<Record<string, unknown>> =>
  traccarFetch<Record<string, unknown>>('/api/server');
