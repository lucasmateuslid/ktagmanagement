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
  identifierKind: EquipmentIdentifierKind;
  identifierProfile?: EquipmentIdentifierProfile;
  identifierOriginal: string;
  identifierNormalized: string;
  imei?: string;
  imeiOriginal?: string;
  macAddress?: string | null;
  traqcareId?: string;
  powerType?: 'battery' | '12v';
  batteryWarrantyYears?: number;
  firstCommunicationAt?: number;
  batteryStartedAt?: number;
  batteryStartSource?: 'first_communication' | 'manual';
  traccarUniqueId: string;
  protocol: 'gt06';
  traccarPort: number;
  usesSimCard: false;
  trackingProvider: 'traccar';
  traccarDeviceId: number | null;
  traccarDeviceName: string;
  traccarPositionId: number | null;
  traccarStatus: XadTagCommunicationStatus;
  integrationStatus: 'pending' | 'registered' | 'error';
  integrationErrorCode?: string | null;
  integrationLeaseUntil?: number | null;
  communicationValidatedAt?: number | null;
  linkedEntityId?: string | null;
  linkedEntityName?: string | null;
  description?: string;
  lastIntegrationCheckAt: number | null;
  lastPosition?: TrackedPosition | null;
  createdAt: number;
  updatedAt: number;
}

export type EquipmentIdentifierKind = 'imei' | 'numeric_serial' | 'mac';
export type EquipmentIdentifierProfile = 'xadtag_legacy_numeric_10_to_15';

export interface NumericSerialPolicy {
  inputLength?: number;
  outputLength?: number;
  padStart?: boolean;
}

export interface NormalizedEquipmentIdentifier {
  kind: EquipmentIdentifierKind;
  original: string;
  normalized: string;
  profile?: EquipmentIdentifierProfile;
}

export function isValidLuhn(value: string): boolean {
  let sum = 0;
  let doubleDigit = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (doubleDigit) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function normalizeImei(input: unknown, options: { validateLuhn?: boolean } = {}): string {
  const value = String(input ?? '');
  if (!value) throw new Error('Informe o IMEI.');
  if (!/^\d+$/.test(value)) throw new Error('IMEI deve conter somente dígitos.');
  if (value.length !== 15) throw new Error('IMEI deve conter exatamente 15 dígitos.');
  if (options.validateLuhn !== false && !isValidLuhn(value)) throw new Error('IMEI inválido (Luhn).');
  return value;
}

export function normalizeMac(input: unknown): string {
  const original = String(input ?? '');
  if (!original) throw new Error('Informe o MAC.');
  if (/[^a-fA-F0-9:\- ]/.test(original)) throw new Error('MAC contém caracteres inválidos.');
  const value = original.replace(/[:\- ]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(value)) throw new Error('MAC deve conter exatamente 12 caracteres hexadecimais.');
  return value;
}

export function normalizeNumericSerial(input: unknown, policy: NumericSerialPolicy = {}): string {
  const value = String(input ?? '');
  if (!value) throw new Error('Informe o serial numérico.');
  if (!/^\d+$/.test(value)) throw new Error('Serial numérico deve conter somente dígitos.');
  if (policy.inputLength && value.length !== policy.inputLength) throw new Error(`Serial numérico deve conter exatamente ${policy.inputLength} dígitos.`);
  if (!policy.outputLength) return value;
  if (value.length > policy.outputLength) throw new Error(`Serial numérico não pode ultrapassar ${policy.outputLength} dígitos.`);
  if (value.length < policy.outputLength && !policy.padStart) throw new Error(`Serial numérico deve conter exatamente ${policy.outputLength} dígitos.`);
  return policy.padStart ? value.padStart(policy.outputLength, '0') : value;
}

export function normalizeEquipmentIdentifier(kind: EquipmentIdentifierKind, original: unknown, profile?: EquipmentIdentifierProfile): NormalizedEquipmentIdentifier {
  const preserved = String(original ?? '');
  if (kind === 'imei') return { kind, original: preserved, normalized: normalizeImei(preserved) };
  if (kind === 'mac') return { kind, original: preserved, normalized: normalizeMac(preserved) };
  const policy = profile === 'xadtag_legacy_numeric_10_to_15'
    ? { inputLength: 10, outputLength: 15, padStart: true }
    : {};
  return { kind, original: preserved, normalized: normalizeNumericSerial(preserved, policy), ...(profile ? { profile } : {}) };
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

export type TrackingHistoryProvider = 'traccar' | 'ktag';

export interface TrackingBattery {
  level: number;
  label?: string;
  color?: string;
}

export interface TrackingHistoryPoint {
  id: string;
  tagId: string;
  vehicleId: string | null;
  provider: TrackingHistoryProvider;
  timestamp: number;
  latitude: number;
  longitude: number;
  address?: string | null;
  altitude?: number;
  speed?: number;
  course?: number;
  accuracy?: number;
  battery?: TrackingBattery;
  heartbeat?: boolean;
}

export interface TrackingHistoryWarning {
  provider: TrackingHistoryProvider;
  tagId?: string;
  code: string;
  message: string;
}

export interface TrackingHistoryPage {
  requestId: string;
  subjectType: 'tag' | 'vehicle';
  subjectId: string;
  from: string;
  to: string;
  points: TrackingHistoryPoint[];
  nextCursor: string | null;
  truncated: boolean;
  partial: boolean;
  warnings: TrackingHistoryWarning[];
}

export interface TrackingHistoryError {
  ok: false;
  requestId: string;
  errorCode: string;
  error: string;
}

export interface TrackingAssignment {
  id: string;
  tenantId: string;
  tagId: string;
  vehicleId: string;
  startedAt: number;
  endedAt: number | null;
  startedBy: string | null;
  endedBy: string | null;
  endReason: string | null;
  startEstimated?: boolean;
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

export const BUSINESS_MODULE_IDS = ['scheduling', 'trackers', 'shipments'] as const;
export type BusinessModuleId = typeof BUSINESS_MODULE_IDS[number];

export interface BusinessModuleCatalogItem {
  id: BusinessModuleId;
  label: string;
  description: string;
}

export const BUSINESS_MODULE_CATALOG: readonly BusinessModuleCatalogItem[] = [
  { id: 'scheduling', label: 'Agendamentos e técnicos', description: 'Agenda, calendário, técnicos e gestão financeira dos técnicos' },
  { id: 'trackers', label: 'Rastreadores', description: 'Cadastro e gestão de rastreadores, ativos e chips' },
  { id: 'shipments', label: 'Envios', description: 'Cotações, remessas, etiquetas e rastreamento logístico' },
] as const;

export interface TrackerModel {
  id: string;
  manufacturer: string;
  name: string;
  protocol?: string;
  connectivity?: string[];
  powerType?: '12v' | 'battery' | 'both';
  active: boolean;
  source?: 'traccar' | 'custom';
  sourceUrl?: string;
}

export interface ManagedTracker {
  id: string;
  imei: string;
  serialNumber?: string;
  modelId: string;
  modelName: string;
  manufacturer: string;
  status: 'disponível' | 'enviado' | 'em_uso' | 'manutencao';
  vehicleId?: string;
  simCardId?: string;
  invertedLockOutput?: boolean;
  password?: string;
  minBatteryVoltage?: number;
  maxBatteryVoltage?: number;
  purchaseDate?: string;
  purchaseValue?: number;
  supplierId?: string;
  warrantyMonths?: number;
  stockId?: string;
  batch?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
