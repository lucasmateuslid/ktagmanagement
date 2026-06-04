// Tipos compartilhados entre backend, web e mobile.
// K-Tag domain types ficam em packages/web/types.ts até migração completa.
// Aqui vivem tipos agnósticos de plataforma (Traccar, API contracts).

export interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address?: string;
  deviceTime: string;
  fixTime: string;
  serverTime: string;
  valid: boolean;
  attributes: Record<string, unknown>;
}

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  disabled: boolean;
  lastUpdate?: string;
  positionId?: number;
  groupId?: number;
  phone?: string;
  model?: string;
  category?: string;
  attributes: Record<string, unknown>;
}

export interface TraccarGeofence {
  id: number;
  name: string;
  description?: string;
  area: string;
  calendarId?: number;
  attributes: Record<string, unknown>;
}

export interface TraccarEvent {
  id: number;
  deviceId: number;
  type: string;
  eventTime: string;
  positionId?: number;
  geofenceId?: number;
  maintenanceId?: number;
  attributes: Record<string, unknown>;
}

// Contrato da API interna do K-Tag Backend
export interface ApiResponse<T> {
  data: T;
  ok: true;
}

export interface ApiError {
  error: string;
  ok: false;
  status?: number;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
