/**
 * traccar.ts — Serviço de integração com o Traccar Server
 *
 * O BFF é o único cliente do Traccar. O frontend nunca chama
 * o Traccar diretamente, mantendo credenciais fora do navegador.
 */

import { env } from '../config/env.js';

export interface TraccarConnectionConfig {
  url: string;
  user: string;
  pass: string;
}

const getHeaders = (config: TraccarConnectionConfig) => {
  const basicAuth = Buffer.from(`${config.user}:${config.pass}`).toString('base64');
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

async function traccarFetch<T>(config: TraccarConnectionConfig, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${config.url}${path}`, {
    ...options,
    headers: { ...getHeaders(config), ...(options?.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Traccar ${path} → HTTP ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

const normalizeConfig = (config: TraccarConnectionConfig): TraccarConnectionConfig => ({
  ...config,
  url: config.url.replace(/\/$/, ''),
});

const getEnvConfig = (): TraccarConnectionConfig => normalizeConfig({
  url: env.traccar.url,
  user: env.traccar.user,
  pass: env.traccar.pass,
});

export const createTraccarApi = (rawConfig?: TraccarConnectionConfig) => {
  const config = normalizeConfig(rawConfig ?? getEnvConfig());

  return {
    getDevices: (): Promise<TraccarDevice[]> =>
      traccarFetch<TraccarDevice[]>(config, '/api/devices'),

    getDeviceByUniqueId: (uniqueId: string): Promise<TraccarDevice[]> =>
      traccarFetch<TraccarDevice[]>(config, `/api/devices?uniqueId=${uniqueId}`),

    getPositions: (deviceId?: number): Promise<TraccarPosition[]> => {
      const qs = deviceId ? `?deviceId=${deviceId}` : '';
      return traccarFetch<TraccarPosition[]>(config, `/api/positions${qs}`);
    },

    getPositionHistory: (
      deviceId: number,
      from: Date,
      to: Date,
    ): Promise<TraccarPosition[]> => {
      const params = new URLSearchParams({
        deviceId: String(deviceId),
        from: from.toISOString(),
        to: to.toISOString(),
      });
      return traccarFetch<TraccarPosition[]>(config, `/api/reports/route?${params}`);
    },

    getGeofences: (): Promise<TraccarGeofence[]> =>
      traccarFetch<TraccarGeofence[]>(config, '/api/geofences'),

    createGeofence: (data: Partial<TraccarGeofence>): Promise<TraccarGeofence> =>
      traccarFetch<TraccarGeofence>(config, '/api/geofences', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    deleteGeofence: (id: number): Promise<void> =>
      traccarFetch<void>(config, `/api/geofences/${id}`, { method: 'DELETE' }),

    getEvents: (
      deviceId: number,
      from: Date,
      to: Date,
    ): Promise<TraccarEvent[]> => {
      const params = new URLSearchParams({
        deviceId: String(deviceId),
        from: from.toISOString(),
        to: to.toISOString(),
      });
      return traccarFetch<TraccarEvent[]>(config, `/api/reports/events?${params}`);
    },

    getServerInfo: (): Promise<Record<string, unknown>> =>
      traccarFetch<Record<string, unknown>>(config, '/api/server'),
  };
};

const defaultApi = createTraccarApi();

// ─────────────────────────────────────────
// Dispositivos
// ─────────────────────────────────────────

/** Lista todos os dispositivos cadastrados no Traccar */
export const getDevices = (): Promise<TraccarDevice[]> =>
  defaultApi.getDevices();

/** Busca um dispositivo pelo uniqueId (IMEI/serial do hardware) */
export const getDeviceByUniqueId = (uniqueId: string): Promise<TraccarDevice[]> =>
  defaultApi.getDeviceByUniqueId(uniqueId);

// ─────────────────────────────────────────
// Posições
// ─────────────────────────────────────────

/** Posição atual de todos os dispositivos (ou de um específico) */
export const getPositions = (deviceId?: number): Promise<TraccarPosition[]> => {
  return defaultApi.getPositions(deviceId);
};

/** Histórico de posições de um dispositivo num intervalo de tempo */
export const getPositionHistory = (
  deviceId: number,
  from: Date,
  to: Date,
): Promise<TraccarPosition[]> => {
  return defaultApi.getPositionHistory(deviceId, from, to);
};

// ─────────────────────────────────────────
// Geofences
// ─────────────────────────────────────────

export const getGeofences = (): Promise<TraccarGeofence[]> =>
  defaultApi.getGeofences();

export const createGeofence = (data: Partial<TraccarGeofence>): Promise<TraccarGeofence> =>
  defaultApi.createGeofence(data);

export const deleteGeofence = (id: number): Promise<void> =>
  defaultApi.deleteGeofence(id);

// ─────────────────────────────────────────
// Eventos
// ─────────────────────────────────────────

export const getEvents = (
  deviceId: number,
  from: Date,
  to: Date,
): Promise<TraccarEvent[]> => {
  return defaultApi.getEvents(deviceId, from, to);
};

// ─────────────────────────────────────────
// Health check
// ─────────────────────────────────────────

export const getServerInfo = (): Promise<Record<string, unknown>> =>
  defaultApi.getServerInfo();
