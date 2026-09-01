import { createHash, randomUUID } from 'node:crypto';
import type {
  TrackingAssignment, TrackingBattery, TrackingHistoryPage, TrackingHistoryPoint,
  TrackingHistoryProvider, TrackingHistoryWarning, TraccarPosition,
} from '@ktag/shared';
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';
import { decryptKtagSecret, KtagConfigurationError, KtagHttpError, ktagClient, type KtagClient } from './ktagClient.js';
import { TraccarHttpError, traccarClient } from './traccarClient.js';

const DAY = 86_400_000;
const TRACCAR_CHUNK_MS = 6 * 3_600_000;
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_POINTS = 1_500;
const DEFAULT_MAX_DAYS = 30;

export type HistoryErrorCode =
  | 'INVALID_RANGE' | 'INVALID_CURSOR' | 'VEHICLE_NOT_FOUND' | 'TAG_NOT_FOUND'
  | 'DEVICE_NOT_LINKED' | 'UNKNOWN_DEVICE_TYPE' | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_TIMEOUT' | 'PROVIDER_RATE_LIMITED' | 'PROVIDER_UNAUTHORIZED'
  | 'PROVIDER_UNAVAILABLE';

export class HistoryRequestError extends Error {
  constructor(message: string, public status = 400, public code: HistoryErrorCode = 'INVALID_RANGE') { super(message); }
}

export type HistoryRange = { from: number; to: number; limit: number; cursor: { timestamp: number; id: string } | null };

const positiveInteger = (name: string, fallback: number) => {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const encodeCursor = (value: { timestamp: number; id: string }) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decodeCursor = (value: unknown) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!Number.isFinite(parsed.timestamp) || parsed.timestamp <= 0 || typeof parsed.id !== 'string' || !parsed.id) throw new Error();
    return parsed as { timestamp: number; id: string };
  } catch { throw new HistoryRequestError('Cursor inválido.', 400, 'INVALID_CURSOR'); }
};

export function parseHistoryRange(query: Record<string, unknown>): HistoryRange {
  if (!query.from || !query.to) throw new HistoryRequestError('Parâmetros from e to são obrigatórios.', 400, 'INVALID_RANGE');
  const from = Date.parse(String(query.from)); const to = Date.parse(String(query.to));
  const maxDays = positiveInteger('HISTORY_MAX_RANGE_DAYS', DEFAULT_MAX_DAYS);
  const maxPoints = positiveInteger('HISTORY_POINT_LIMIT_MAX', DEFAULT_MAX_POINTS);
  const defaultPageSize = Math.min(maxPoints, positiveInteger('HISTORY_PAGE_SIZE_DEFAULT', DEFAULT_PAGE_SIZE));
  const requestedLimit = query.limit === undefined ? defaultPageSize : Number(query.limit);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > maxPoints) throw new HistoryRequestError(`Limite inválido; máximo de ${maxPoints} pontos.`, 400, 'INVALID_RANGE');
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > maxDays * DAY) throw new HistoryRequestError(`Intervalo inválido; máximo de ${maxDays} dias.`, 400, 'INVALID_RANGE');
  return { from, to, limit: requestedLimit, cursor: decodeCursor(query.cursor) };
}

export const historyTimestampToMillis = (value: unknown): number => {
  if (typeof value === 'string') return Date.parse(value);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.NaN;
  return parsed < 1e12 ? parsed * 1_000 : parsed;
};

export const validHistoryCoordinate = (latitude: number, longitude: number) => Number.isFinite(latitude) && Number.isFinite(longitude)
  && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && !(latitude === 0 && longitude === 0);

const normalizeBattery = (value: unknown): TrackingBattery | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return { level: Math.min(100, Math.max(0, value)) };
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>; const level = Number(source.level);
  if (!Number.isFinite(level)) return undefined;
  return { level: Math.min(100, Math.max(0, level)), ...(typeof source.label === 'string' ? { label: source.label } : {}), ...(typeof source.color === 'string' ? { color: source.color } : {}) };
};

const pointId = (provider: TrackingHistoryProvider, tagId: string, sourceId: unknown, timestamp: number, latitude: number, longitude: number) => {
  if (sourceId !== undefined && sourceId !== null && String(sourceId)) return `${provider}:${String(sourceId)}`;
  return `${provider}:${createHash('sha256').update(`${tagId}|${timestamp}|${latitude}|${longitude}`).digest('hex')}`;
};

export function normalizeTraccarPosition(tagId: string, vehicleId: string | null, raw: TraccarPosition): TrackingHistoryPoint | null {
  const timestamp = historyTimestampToMillis(raw.fixTime || raw.deviceTime || raw.serverTime);
  const latitude = Number(raw.latitude); const longitude = Number(raw.longitude);
  if (!Number.isFinite(timestamp) || !validHistoryCoordinate(latitude, longitude)) return null;
  return {
    id: pointId('traccar', tagId, raw.id, timestamp, latitude, longitude), tagId, vehicleId,
    provider: 'traccar', timestamp, latitude, longitude, address: raw.address ?? null,
    altitude: Number.isFinite(raw.altitude) ? raw.altitude : undefined,
    speed: Number.isFinite(raw.speed) ? raw.speed : undefined,
    course: Number.isFinite(raw.course) ? raw.course : undefined,
    accuracy: typeof raw.attributes?.accuracy === 'number' && Number.isFinite(raw.attributes.accuracy) ? raw.attributes.accuracy : undefined,
    battery: normalizeBattery(raw.attributes?.batteryLevel),
  };
}

export function normalizeFirestorePosition(data: FirebaseFirestore.DocumentData, sourceId: string): TrackingHistoryPoint | null {
  const tagId = String(data.tagId || ''); const timestamp = historyTimestampToMillis(data.timestamp);
  const latitude = Number(data.lat ?? data.latitude); const longitude = Number(data.lon ?? data.longitude);
  if (!tagId || !Number.isFinite(timestamp) || !validHistoryCoordinate(latitude, longitude)) return null;
  return {
    id: pointId('ktag', tagId, sourceId, timestamp, latitude, longitude), tagId,
    vehicleId: data.vehicleIdAtCapture ? String(data.vehicleIdAtCapture) : null,
    provider: 'ktag', timestamp, latitude, longitude, address: data.address ?? null,
    altitude: Number.isFinite(data.altitude) ? data.altitude : undefined,
    speed: Number.isFinite(data.speed) ? data.speed : undefined,
    course: Number.isFinite(data.course) ? data.course : undefined,
    accuracy: Number.isFinite(data.accuracy ?? data.conf) ? Number(data.accuracy ?? data.conf) : undefined,
    battery: normalizeBattery(data.battery), heartbeat: Boolean(data.heartbeat),
  };
}

export function normalizeKtagApiPosition(tagId: string, vehicleId: string | null, raw: Awaited<ReturnType<KtagClient['getHistory']>>[number]): TrackingHistoryPoint {
  const battery = raw.status === 3 ? { level: 100, label: 'Alto', color: '#10b981' }
    : raw.status === 2 ? { level: 60, label: 'Médio', color: '#eab308' }
      : raw.status === 1 ? { level: 30, label: 'Baixo', color: '#f97316' }
        : { level: 10, label: 'Muito baixo', color: '#ef4444' };
  return {
    id: pointId('ktag', tagId, raw.sourceId, raw.timestamp, raw.lat, raw.lon), tagId, vehicleId,
    provider: 'ktag', timestamp: raw.timestamp, latitude: raw.lat, longitude: raw.lon,
    accuracy: raw.conf, battery,
  };
}

const olderThanCursor = (point: TrackingHistoryPoint, cursor: HistoryRange['cursor']) => !cursor || point.timestamp < cursor.timestamp || (point.timestamp === cursor.timestamp && point.id < cursor.id);
export const historyPointKey = (point: Pick<TrackingHistoryPoint, 'tagId' | 'timestamp' | 'latitude' | 'longitude'>) => `${point.tagId}|${point.timestamp}|${point.latitude}|${point.longitude}`;

export function normalizeHistoryPoints(points: TrackingHistoryPoint[], range: HistoryRange) {
  const unique = new Map<string, TrackingHistoryPoint>();
  for (const point of points) {
    if (!validHistoryCoordinate(point.latitude, point.longitude) || !Number.isFinite(point.timestamp) || point.timestamp <= 0 || !olderThanCursor(point, range.cursor)) continue;
    const key = historyPointKey(point); const existing = unique.get(key);
    if (!existing || point.id.localeCompare(existing.id) < 0) unique.set(key, point);
  }
  return [...unique.values()].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
}

export interface HistoryProvider {
  readonly provider: TrackingHistoryProvider;
  load(input: { tenantId: string; tagId: string; vehicleId: string | null; deviceId?: number; from: number; to: number; range: HistoryRange }): Promise<TrackingHistoryPoint[]>;
}

export class KtagHistoryProvider implements HistoryProvider {
  readonly provider = 'ktag' as const;
  constructor(private readonly client: Pick<KtagClient, 'getHistory'> = ktagClient) {}
  async load(input: { tenantId: string; tagId: string; vehicleId: string | null; from: number; to: number; range: HistoryRange }) {
    if (!input.tagId) return [];
    const tag = await adminDb.doc(`tenants/${input.tenantId}/tags/${input.tagId}`).get();
    if (!tag.exists) throw new HistoryRequestError('K-TAG não encontrada.', 404, 'TAG_NOT_FOUND');

    // A coleção persistida é a fonte do trajeto (incluindo paginação de 30
    // dias). A API K-TAG é consultada apenas na primeira página para não
    // deixar o usuário esperar o próximo ciclo do worker pelo último ponto.
    const upperBound = Math.min(input.to, input.range.cursor?.timestamp ?? input.to);
    let query: FirebaseFirestore.Query = adminDb.collection(`tenants/${input.tenantId}/tag_history`)
      .where('tagId', '==', input.tagId).where('timestamp', '>=', input.from).where('timestamp', '<=', upperBound)
      .orderBy('timestamp', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(input.range.limit + 1);
    if (input.range.cursor?.id.startsWith('ktag:')) query = query.startAfter(input.range.cursor.timestamp, input.range.cursor.id.slice(5));
    const stored = (await query.get()).docs
      .map(doc => normalizeFirestorePosition(doc.data(), doc.id))
      .filter((point): point is TrackingHistoryPoint => Boolean(point));

    if (input.range.cursor) return stored;
    const hashedKey = decryptKtagSecret(input.tenantId, tag.get('hashedAdvKey'));
    const privateKey = decryptKtagSecret(input.tenantId, tag.get('privateKey'));
    if (!hashedKey || !privateKey) {
      if (stored.length) return stored;
      throw new HistoryRequestError('K-TAG sem credenciais válidas.', 409, 'DEVICE_NOT_LINKED');
    }
    try {
      const values = await this.client.getHistory([{ hashedKey, privateKey }]);
      const current = values.map(raw => normalizeKtagApiPosition(input.tagId, input.vehicleId, raw))
        .filter(point => point.timestamp >= input.from && point.timestamp <= input.to);
      return [...stored, ...current];
    } catch (error) {
      // Um histórico já capturado continua útil mesmo se a API pontual estiver
      // indisponível. Só propagamos a falha quando não há nenhum dado local.
      if (stored.length) return stored;
      throw mapProviderError(error);
    }
  }
}

export class TraccarHistoryProvider implements HistoryProvider {
  readonly provider = 'traccar' as const;
  async load(input: { tagId: string; vehicleId: string | null; deviceId?: number; from: number; to: number; range: HistoryRange }) {
    if (!Number.isInteger(input.deviceId)) throw new HistoryRequestError('XADTAG sem traccarDeviceId válido.', 409, 'DEVICE_NOT_LINKED');
    if (!traccarClient.safeConfig.configured) throw new HistoryRequestError('Integração Traccar não configurada.', 503, 'PROVIDER_NOT_CONFIGURED');
    const points: TrackingHistoryPoint[] = []; const upperBound = Math.min(input.to, input.range.cursor?.timestamp ?? input.to);
    try {
      for (let end = upperBound; end > input.from && points.length <= input.range.limit; end -= TRACCAR_CHUNK_MS) {
        const start = Math.max(input.from, end - TRACCAR_CHUNK_MS);
        const values = await traccarClient.getRoute(input.deviceId!, new Date(start).toISOString(), new Date(end).toISOString());
        points.push(...values.map(raw => normalizeTraccarPosition(input.tagId, input.vehicleId, raw)).filter((point): point is TrackingHistoryPoint => Boolean(point)));
      }
      return points;
    } catch (error) { throw mapProviderError(error); }
  }
}

export function mapProviderError(error: unknown): HistoryRequestError {
  if (error instanceof HistoryRequestError) return error;
  if (error instanceof KtagConfigurationError) return new HistoryRequestError(error.message, 503, 'PROVIDER_NOT_CONFIGURED');
  if (error instanceof KtagHttpError) {
    if (error.status === 401 || error.status === 403) return new HistoryRequestError('Integração K-TAG recusou a autenticação.', 502, 'PROVIDER_UNAUTHORIZED');
    if (error.status === 429) return new HistoryRequestError('Limite de consultas da K-TAG excedido.', 502, 'PROVIDER_RATE_LIMITED');
    return new HistoryRequestError('A API K-TAG está indisponível.', 502, 'PROVIDER_UNAVAILABLE');
  }
  if (error instanceof TraccarHttpError) {
    if (error.status === 401 || error.status === 403) return new HistoryRequestError('Integração Traccar recusou a autenticação.', 502, 'PROVIDER_UNAUTHORIZED');
    if (error.status === 429) return new HistoryRequestError('Limite de consultas do provedor excedido.', 502, 'PROVIDER_RATE_LIMITED');
    return new HistoryRequestError('O provedor de rastreamento está indisponível.', 502, 'PROVIDER_UNAVAILABLE');
  }
  if (error instanceof Error && /tempo limite/i.test(error.message)) return new HistoryRequestError('Tempo limite ao consultar o provedor.', 504, 'PROVIDER_TIMEOUT');
  return new HistoryRequestError('O provedor de rastreamento está indisponível.', 502, 'PROVIDER_UNAVAILABLE');
}

const page = (requestId: string, subjectType: 'tag' | 'vehicle', subjectId: string, range: HistoryRange, points: TrackingHistoryPoint[], warnings: TrackingHistoryWarning[]): TrackingHistoryPage => {
  const ordered = normalizeHistoryPoints(points, range); const truncated = ordered.length > range.limit;
  const selected = ordered.slice(0, range.limit); const last = selected.at(-1);
  return { requestId, subjectType, subjectId, from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString(), points: selected, nextCursor: truncated && last ? encodeCursor({ timestamp: last.timestamp, id: last.id }) : null, truncated, partial: warnings.length > 0 && selected.length > 0, warnings };
};

const tagType = (tag: FirebaseFirestore.DocumentSnapshot) => String(tag.get('type') || tag.get('equipmentType') || '').toUpperCase();

export class TrackingHistoryService {
  constructor(private readonly ktag: HistoryProvider = new KtagHistoryProvider(), private readonly traccar: HistoryProvider = new TraccarHistoryProvider()) {}
  async forTag(tenantId: string, tagId: string, query: Record<string, unknown>, requestId?: string) {
    requestId ||= randomUUID();
    const range = parseHistoryRange(query); const tag = await adminDb.doc(`tenants/${tenantId}/tags/${tagId}`).get();
    if (!tag.exists) throw new HistoryRequestError('Tag não encontrada.', 404, 'TAG_NOT_FOUND');
    const type = tagType(tag); let points: TrackingHistoryPoint[];
    if (type === 'XADTAG') points = await this.traccar.load({ tenantId, tagId, vehicleId: tag.get('linkedEntityId') || null, deviceId: tag.get('traccarDeviceId'), from: range.from, to: range.to, range });
    else if (type === 'K_TAG') points = await this.ktag.load({ tenantId, tagId, vehicleId: null, from: range.from, to: range.to, range });
    else throw new HistoryRequestError('Tipo de dispositivo incompatível com histórico.', 422, 'UNKNOWN_DEVICE_TYPE');
    return page(requestId, 'tag', tagId, range, points, []);
  }
  async forVehicle(tenantId: string, vehicleId: string, query: Record<string, unknown>, requestId?: string) {
    requestId ||= randomUUID();
    const range = parseHistoryRange(query); const warnings: TrackingHistoryWarning[] = [];
    const vehicle = await adminDb.doc(`tenants/${tenantId}/vehicles/${vehicleId}`).get();
    if (!vehicle.exists) throw new HistoryRequestError('Veículo não encontrado.', 404, 'VEHICLE_NOT_FOUND');
    const assignmentSnap = await adminDb.collection(`tenants/${tenantId}/tracking_assignments`).where('vehicleId', '==', vehicleId).get();
    let assignments = assignmentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackingAssignment)).filter(item => item.startedAt <= range.to && (item.endedAt === null || item.endedAt >= range.from));
    if (!assignments.length && vehicle.get('tagId')) assignments = [{ id: 'legacy-current', tenantId, vehicleId, tagId: String(vehicle.get('tagId')), startedAt: range.from, endedAt: null, startedBy: null, endedBy: null, endReason: null, startEstimated: true }];
    const points: TrackingHistoryPoint[] = [];
    if (!assignments.length) throw new HistoryRequestError('Veículo sem dispositivo vinculado no período.', 409, 'DEVICE_NOT_LINKED');
    for (const assignment of assignments) {
      const tag = await adminDb.doc(`tenants/${tenantId}/tags/${assignment.tagId}`).get();
      if (!tag.exists) { warnings.push({ provider: 'traccar', tagId: assignment.tagId, code: 'TAG_NOT_FOUND', message: 'Uma tag vinculada ao período não foi encontrada.' }); continue; }
      const type = tagType(tag);
      const provider = type === 'K_TAG' ? this.ktag : type === 'XADTAG' ? this.traccar : null;
      if (!provider) { warnings.push({ provider: 'traccar', tagId: assignment.tagId, code: 'UNKNOWN_DEVICE_TYPE', message: 'Uma tag possui tipo incompatível com histórico.' }); continue; }
      try { points.push(...await provider.load({ tenantId, tagId: assignment.tagId, vehicleId, deviceId: tag.get('traccarDeviceId'), from: Math.max(range.from, assignment.startedAt), to: Math.min(range.to, assignment.endedAt ?? range.to), range })); }
      catch (error) { const mapped = mapProviderError(error); warnings.push({ provider: provider.provider, tagId: assignment.tagId, code: mapped.code, message: mapped.message }); }
    }
    if (!points.length && warnings.length) { const warning = warnings[0]; const status = warning.code === 'DEVICE_NOT_LINKED' ? 409 : warning.code === 'UNKNOWN_DEVICE_TYPE' ? 422 : warning.code === 'TAG_NOT_FOUND' ? 404 : 502; throw new HistoryRequestError(warning.message, status, warning.code as HistoryErrorCode); }
    return page(requestId, 'vehicle', vehicleId, range, points, warnings);
  }
}

export const trackingHistoryService = new TrackingHistoryService();
