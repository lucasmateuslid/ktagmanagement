import { FieldPath } from 'firebase-admin/firestore';
import type { TrackingAssignment, TrackingHistoryPage, TrackingHistoryPoint, TrackingHistoryWarning, TraccarPosition } from '@ktag/shared';
import { adminDb } from './firebaseAdmin.js';
import { traccarClient } from './traccarClient.js';

const DAY = 86_400_000;
const CHUNK = 6 * 3_600_000;

export class HistoryRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type Range = { from: number; to: number; limit: number; cursor: { timestamp: number; id: string } | null };

const encodeCursor = (value: { timestamp: number; id: string }) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decodeCursor = (value: unknown) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!Number.isFinite(parsed.timestamp) || typeof parsed.id !== 'string') throw new Error();
    return parsed as { timestamp: number; id: string };
  } catch { throw new HistoryRequestError('Cursor inválido.'); }
};

export function parseHistoryRange(query: Record<string, unknown>): Range {
  const now = Date.now();
  const from = Date.parse(String(query.from || new Date(now - DAY).toISOString()));
  const to = Date.parse(String(query.to || new Date(now).toISOString()));
  const limit = Math.min(1500, Math.max(1, Number(query.limit) || 500));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 30 * DAY) {
    throw new HistoryRequestError('Intervalo inválido; máximo de 30 dias.');
  }
  return { from, to, limit, cursor: decodeCursor(query.cursor) };
}

const olderThanCursor = (point: TrackingHistoryPoint, cursor: Range['cursor']) => !cursor
  || point.timestamp < cursor.timestamp
  || (point.timestamp === cursor.timestamp && point.id < cursor.id);

const traccarPoint = (tagId: string, vehicleId: string | null, raw: TraccarPosition): TrackingHistoryPoint => ({
  id: `traccar:${raw.id}`,
  tagId,
  vehicleId,
  provider: 'traccar',
  timestamp: Date.parse(raw.fixTime || raw.deviceTime || raw.serverTime || ''),
  latitude: raw.latitude,
  longitude: raw.longitude,
  address: raw.address ?? null,
  altitude: raw.altitude,
  speed: raw.speed,
  course: raw.course,
  accuracy: typeof raw.attributes?.accuracy === 'number' ? raw.attributes.accuracy : undefined,
  battery: raw.attributes?.batteryLevel,
});

const firestorePoint = (data: FirebaseFirestore.DocumentData, id: string): TrackingHistoryPoint => ({
  id: `ktag:${id}`,
  tagId: String(data.tagId),
  vehicleId: data.vehicleIdAtCapture ? String(data.vehicleIdAtCapture) : null,
  provider: 'ktag',
  timestamp: Number(data.timestamp),
  latitude: Number(data.lat ?? data.latitude),
  longitude: Number(data.lon ?? data.longitude),
  address: data.address ?? null,
  altitude: data.altitude,
  speed: data.speed,
  course: data.course,
  accuracy: data.accuracy ?? data.conf,
  battery: data.battery,
  heartbeat: Boolean(data.heartbeat),
});

export const normalizeHistoryPoints = (points: TrackingHistoryPoint[], range: Range) => {
  const unique = new Map<string, TrackingHistoryPoint>();
  for (const point of points) {
    if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || !olderThanCursor(point, range.cursor)) continue;
    unique.set(`${point.provider}|${point.id}|${point.timestamp}|${point.latitude}|${point.longitude}`, point);
  }
  return [...unique.values()].sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id));
};

async function loadKtag(tenantId: string, field: 'tagId' | 'vehicleIdAtCapture', value: string, range: Range) {
  let query: FirebaseFirestore.Query = adminDb.collection(`tenants/${tenantId}/tag_history`)
    .where(field, '==', value).where('timestamp', '>=', range.from).where('timestamp', '<=', range.to)
    .orderBy('timestamp', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(range.limit + 1);
  if (range.cursor?.id.startsWith('ktag:')) query = query.startAfter(range.cursor.timestamp, range.cursor.id.slice(5));
  const snap = await query.get();
  return snap.docs.map(doc => firestorePoint(doc.data(), doc.id));
}

async function loadTraccar(tagId: string, vehicleId: string | null, deviceId: number, from: number, to: number, range: Range) {
  const points: TrackingHistoryPoint[] = [];
  const upperBound = Math.min(to, range.cursor?.timestamp ?? to);
  for (let end = upperBound; end > from && points.length <= range.limit; end -= CHUNK) {
    const start = Math.max(from, end - CHUNK);
    const values = await traccarClient.getRoute(deviceId, new Date(start).toISOString(), new Date(end).toISOString());
    points.push(...values.map(raw => traccarPoint(tagId, vehicleId, raw)));
  }
  return points;
}

const page = (subjectType: 'tag' | 'vehicle', subjectId: string, range: Range, points: TrackingHistoryPoint[], warnings: TrackingHistoryWarning[]): TrackingHistoryPage => {
  const ordered = normalizeHistoryPoints(points, range);
  const truncated = ordered.length > range.limit;
  const selected = ordered.slice(0, range.limit);
  const last = selected.at(-1);
  return {
    subjectType, subjectId, from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString(),
    points: selected, nextCursor: truncated && last ? encodeCursor({ timestamp: last.timestamp, id: last.id }) : null,
    truncated, partial: warnings.length > 0 && selected.length > 0, warnings,
  };
};

export class TrackingHistoryService {
  async forTag(tenantId: string, tagId: string, query: Record<string, unknown>) {
    const range = parseHistoryRange(query);
    const tag = await adminDb.doc(`tenants/${tenantId}/tags/${tagId}`).get();
    if (!tag.exists) throw new HistoryRequestError('Tag não encontrada.', 404);
    const type = String(tag.get('type') || tag.get('equipmentType'));
    if (type === 'XADTAG') {
      const deviceId = tag.get('traccarDeviceId');
      if (!Number.isInteger(deviceId)) throw new HistoryRequestError('XADTAG sem traccarDeviceId válido.', 409);
      const points = await loadTraccar(tagId, tag.get('linkedEntityId') || null, deviceId, range.from, range.to, range);
      return page('tag', tagId, range, points, []);
    }
    return page('tag', tagId, range, await loadKtag(tenantId, 'tagId', tagId, range), []);
  }

  async forVehicle(tenantId: string, vehicleId: string, query: Record<string, unknown>) {
    const range = parseHistoryRange(query); const warnings: TrackingHistoryWarning[] = [];
    const vehicle = await adminDb.doc(`tenants/${tenantId}/vehicles/${vehicleId}`).get();
    if (!vehicle.exists) throw new HistoryRequestError('Veículo não encontrado.', 404);
    const assignmentSnap = await adminDb.collection(`tenants/${tenantId}/tracking_assignments`).where('vehicleId', '==', vehicleId).get();
    let assignments = assignmentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackingAssignment))
      .filter(item => item.startedAt <= range.to && (item.endedAt === null || item.endedAt >= range.from));
    if (!assignments.length && vehicle.get('tagId')) assignments = [{ id: 'legacy-current', tenantId, vehicleId, tagId: String(vehicle.get('tagId')), startedAt: range.from, endedAt: null, startedBy: null, endedBy: null, endReason: null, startEstimated: true }];
    const points: TrackingHistoryPoint[] = await loadKtag(tenantId, 'vehicleIdAtCapture', vehicleId, range);
    for (const assignment of assignments) {
      const tag = await adminDb.doc(`tenants/${tenantId}/tags/${assignment.tagId}`).get();
      if (!tag.exists || String(tag.get('type') || tag.get('equipmentType')) !== 'XADTAG') continue;
      const deviceId = tag.get('traccarDeviceId');
      if (!Number.isInteger(deviceId)) { warnings.push({ provider: 'traccar', tagId: assignment.tagId, code: 'DEVICE_NOT_LINKED', message: 'XADTAG sem vínculo válido com o Traccar.' }); continue; }
      try {
        points.push(...await loadTraccar(assignment.tagId, vehicleId, deviceId, Math.max(range.from, assignment.startedAt), Math.min(range.to, assignment.endedAt ?? range.to), range));
      } catch {
        warnings.push({ provider: 'traccar', tagId: assignment.tagId, code: 'TRACCAR_UNAVAILABLE', message: 'Parte do histórico do Traccar está indisponível.' });
      }
    }
    if (!points.length && warnings.length) throw new HistoryRequestError(warnings[0].message, 502);
    return page('vehicle', vehicleId, range, points, warnings);
  }
}

export const trackingHistoryService = new TrackingHistoryService();
