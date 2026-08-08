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

export type XadTagCommunicationStatus = 'online' | 'delayed' | 'offline' | 'unknown';
export type XadTagIntegrationStatus = 'linked' | 'pending' | 'unavailable';
export type TraccarRealtimeStatus = 'connected' | 'reconnecting' | 'rest_fallback' | 'disconnected';

export interface XadTag {
  id: string;
  name: string;
  type: 'XADTAG';
  accessoryId: string;
  tenantId: string;
  equipmentType: 'XADTAG';
  model: 'XADTAG';
  imei: string;
  imeiOriginal: string;
  macAddress?: string | null;
  identifierNormalized: string;
  protocol: 'gt06';
  traccarPort: number;
  usesSimCard: false;
  trackingProvider: 'traccar';
  traccarDeviceId: number;
  traccarDeviceName: string;
  traccarPositionId: number | null;
  traccarStatus: XadTagCommunicationStatus;
  integrationStatus: XadTagIntegrationStatus;
  linkedEntityId?: string | null;
  linkedEntityName?: string | null;
  description?: string;
  lastIntegrationCheckAt: number | null;
  lastPosition?: TrackedPosition | null;
  createdAt: number;
  updatedAt: number;
}

export interface TrackedPosition {
  id?: number;
  deviceId?: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  course?: number;
  accuracy?: number;
  valid: boolean;
  address?: string | null;
  addressResolutionStatus?: 'resolved' | 'failed' | 'pending';
  addressResolutionAttempts?: number;
  deviceTime?: string;
  fixTime?: string;
  serverTime?: string;
  attributes?: Record<string, unknown>;
}

export interface LiveMapTrackedAsset extends Omit<TrackedPosition, 'id'> {
  id: string;
  source: 'traccar' | 'ktag' | string;
  equipmentType: string;
  tenantId: string;
  imei: string;
  uniqueId: string;
  traccarDeviceId: number;
  linkedEntityId?: string | null;
  linkedEntityName?: string | null;
  status: XadTagCommunicationStatus;
  lastUpdate?: string;
}

export interface TraccarSocketMessage {
  devices?: TraccarDevice[];
  positions?: TraccarPosition[];
  events?: TraccarEvent[];
}

export interface AddressResolution {
  address: string | null;
  status: 'resolved' | 'failed';
  provider: 'traccar' | 'existing' | 'fallback' | null;
  attempts: number;
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
