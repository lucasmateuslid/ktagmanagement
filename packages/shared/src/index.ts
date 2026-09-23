// Tipos compartilhados entre backend, web e mobile.
// K-Tag domain types ficam em packages/web/types.ts até migração completa.
// Aqui vivem tipos agnósticos de plataforma (Traccar, API contracts).

export type BrazilianDocumentType = 'cpf' | 'cnpj';
export type BrazilianDocumentValidationReason =
  | 'empty'
  | 'incomplete'
  | 'invalid-length'
  | 'repeated'
  | 'invalid-check-digits'
  | 'valid';

export interface BrazilianDocumentValidation {
  type: BrazilianDocumentType;
  digits: string;
  complete: boolean;
  valid: boolean;
  reason: BrazilianDocumentValidationReason;
}

/** Remove qualquer caractere não numérico e limita o tamanho quando solicitado. */
export function normalizeDigits(value: unknown, maxLength?: number): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return maxLength === undefined ? digits : digits.slice(0, maxLength);
}

export const documentDigits = (value: unknown): string => normalizeDigits(value);
export const normalizeCPF = (value: unknown): string => normalizeDigits(value);
export const normalizeCNPJ = (value: unknown): string => normalizeDigits(value);

/** Verdadeiro somente quando TODOS os dígitos são iguais. */
export function isFullyRepeatedDigits(value: unknown): boolean {
  const digits = normalizeDigits(value);
  return digits.length > 1 && /^(\d)\1+$/.test(digits);
}

export function validateCPF(value: unknown): BrazilianDocumentValidation {
  const cpf = normalizeCPF(value);
  if (!cpf) return { type: 'cpf', digits: cpf, complete: false, valid: false, reason: 'empty' };
  if (cpf.length < 11) return { type: 'cpf', digits: cpf, complete: false, valid: false, reason: 'incomplete' };
  if (cpf.length > 11) return { type: 'cpf', digits: cpf, complete: true, valid: false, reason: 'invalid-length' };
  if (isFullyRepeatedDigits(cpf)) return { type: 'cpf', digits: cpf, complete: true, valid: false, reason: 'repeated' };

  for (let size = 9; size <= 10; size += 1) {
    let sum = 0;
    for (let index = 0; index < size; index += 1) {
      sum += Number(cpf[index]) * (size + 1 - index);
    }
    const checkDigit = ((sum * 10) % 11) % 10;
    if (checkDigit !== Number(cpf[size])) {
      return { type: 'cpf', digits: cpf, complete: true, valid: false, reason: 'invalid-check-digits' };
    }
  }

  return { type: 'cpf', digits: cpf, complete: true, valid: true, reason: 'valid' };
}

export function validateCNPJ(value: unknown): BrazilianDocumentValidation {
  const cnpj = normalizeCNPJ(value);
  if (!cnpj) return { type: 'cnpj', digits: cnpj, complete: false, valid: false, reason: 'empty' };
  if (cnpj.length < 14) return { type: 'cnpj', digits: cnpj, complete: false, valid: false, reason: 'incomplete' };
  if (cnpj.length > 14) return { type: 'cnpj', digits: cnpj, complete: true, valid: false, reason: 'invalid-length' };
  if (isFullyRepeatedDigits(cnpj)) return { type: 'cnpj', digits: cnpj, complete: true, valid: false, reason: 'repeated' };

  const calculateCheckDigit = (length: 12 | 13): number => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = weights.reduce(
      (sum, weight, index) => sum + Number(cnpj[index]) * weight,
      0,
    ) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const valid = calculateCheckDigit(12) === Number(cnpj[12])
    && calculateCheckDigit(13) === Number(cnpj[13]);
  return {
    type: 'cnpj',
    digits: cnpj,
    complete: true,
    valid,
    reason: valid ? 'valid' : 'invalid-check-digits',
  };
}

export function validateCpfCnpj(value: unknown): BrazilianDocumentValidation {
  const digits = documentDigits(value);
  if (digits.length <= 11) return validateCPF(digits);
  return validateCNPJ(digits);
}

export const isValidCPF = (value: unknown): boolean => validateCPF(value).valid;
export const isValidCNPJ = (value: unknown): boolean => validateCNPJ(value).valid;
export const isValidCpfCnpj = (value: unknown): boolean => validateCpfCnpj(value).valid;

export function formatCPF(value: unknown): string {
  const digits = normalizeCPF(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatCNPJ(value: unknown): string {
  const digits = normalizeCNPJ(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\/\d{4})(\d)/, '$1-$2');
}

export function formatCpfCnpj(value: unknown): string {
  const digits = documentDigits(value).slice(0, 14);
  return digits.length <= 11 ? formatCPF(digits) : formatCNPJ(digits);
}

/**
 * Normaliza telefone brasileiro para DDD+número. Aceita o DDI 55 em entradas
 * legadas/E.164 e evita confundi-lo com o DDD 55 em números nacionais.
 */
export function normalizePhone(value: unknown): string {
  const raw = String(value ?? '');
  let digits = normalizeDigits(raw);
  const explicitlyInternational = /^\s*\+\s*55(?:\D|$)/.test(raw);
  if (digits.startsWith('55') && (explicitlyInternational || digits.length > 11)) {
    digits = digits.slice(2);
  }
  return digits;
}

export function isValidPhone(value: unknown): boolean {
  const length = normalizePhone(value).length;
  return length === 10 || length === 11;
}

export function formatPhone(value: unknown): string {
  const digits = normalizePhone(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;

  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${areaCode}) ${number}`;
  const prefixLength = digits.length === 11 ? 5 : 4;
  return `(${areaCode}) ${number.slice(0, prefixLength)}-${number.slice(prefixLength)}`;
}

export function toBrazilianE164(value: unknown): string {
  const digits = normalizePhone(value);
  return isValidPhone(digits) ? `55${digits}` : digits;
}

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
  equipmentId?: string;
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
