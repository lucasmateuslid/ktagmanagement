import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';
import { ktagClient } from './ktagClient.js';
import { ktagHistoryPointId } from './ktagHistoryCapture.js';
import { makeKtagRefreshItem, syncKtagKeysForTenant } from './ktagKeySyncService.js';
import { resolveServerAddress, samePosition } from './serverAddressResolver.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { xadTagService } from './xadtagService.js';

const RETENTION_MS = (Number(process.env.KTAG_HISTORY_RETENTION_DAYS) || 30) * 86_400_000;
const pending = new Map<string, Promise<SingleTagLocation>>();

export type SingleTagLocation = {
  id: string;
  tagId: string;
  vehicleId?: string;
  provider: 'ktag' | 'traccar';
  timestamp: number;
  isodatetime: string;
  lat: number;
  lon: number;
  address?: string | null;
  battery?: { level: number; label: string; color: string };
  [key: string]: unknown;
};

const battery = (status: number) => status === 0
  ? { level: 100, label: 'Alto', color: '#10b981' }
  : status === 1 ? { level: 60, label: 'Médio', color: '#eab308' }
    : status === 2 ? { level: 30, label: 'Baixo', color: '#f97316' }
      : { level: 10, label: 'Muito baixo', color: '#ef4444' };

const trackedTime = (position: any) => Number(position?.timestamp ?? Date.parse(String(position?.fixTime || position?.deviceTime || position?.serverTime || ''))) || 0;

async function linkedVehicle(tenantId: string, tagId: string) {
  const snap = await adminDb.collection(`tenants/${tenantId}/vehicles`).where('tagId', '==', tagId).limit(1).get();
  return snap.docs[0] || null;
}

async function refreshKtag(tenantId: string, tag: FirebaseFirestore.DocumentSnapshot): Promise<SingleTagLocation> {
  const item = makeKtagRefreshItem(tenantId, tag);
  const load = async () => item.hashedAdvKey && item.privateKey
    ? (await ktagClient.getHistory([{ hashedKey: item.hashedAdvKey, privateKey: item.privateKey }]))[0] || null
    : null;

  let normalized = await load();
  if (!normalized) {
    await syncKtagKeysForTenant(tenantId, [item]);
    normalized = await load();
  }
  if (!normalized) throw Object.assign(new Error('A Feibao não retornou uma posição para esta K-TAG.'), { status: 404 });

  const vehicle = await linkedVehicle(tenantId, tag.id); const previous = tag.get('lastPosition');
  const reusableAddress = samePosition(previous, normalized.lat, normalized.lon) ? String(previous?.address || '') : '';
  const freshAddress = await resolveServerAddress(normalized.lat, normalized.lon, reusableAddress || null);
  const address = freshAddress.address || reusableAddress || null;
  const id = ktagHistoryPointId(tag.id, normalized);
  const point: SingleTagLocation = {
    ...normalized, id, tagId: tag.id, ...(vehicle ? { vehicleId: vehicle.id } : {}), provider: 'ktag',
    battery: battery(normalized.status), address, addressResolutionStatus: address ? 'resolved' : 'failed',
    addressResolutionProvider: freshAddress.provider, addressResolvedAt: Date.now(),
  };
  const historyRef = adminDb.doc(`tenants/${tenantId}/tag_history/${id}`);
  await adminDb.runTransaction(async tx => {
    const [freshTag, existing, freshVehicle] = await Promise.all([
      tx.get(tag.ref), tx.get(historyRef), vehicle ? tx.get(vehicle.ref) : Promise.resolve(null),
    ]);
    if (!existing.exists) tx.create(historyRef, { ...point, savedAt: Date.now(), expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS) });
    else if (address) tx.set(historyRef, { address, addressResolutionStatus: 'resolved', addressResolutionProvider: freshAddress.provider, addressResolvedAt: Date.now() }, { merge: true });
    if (freshVehicle && normalized.timestamp >= Number(freshVehicle.get('lastPosition.timestamp') || 0)) {
      tx.update(freshVehicle.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now(), ktagHistoryCapturedThrough: Math.max(Number(freshVehicle.get('ktagHistoryCapturedThrough') || 0), normalized.timestamp) });
    }
    const tagUpdate: Record<string, unknown> = { updatedAt: Date.now(), lastRefreshAttemptAt: Date.now(), lastRefreshStatus: 'success' };
    if (!freshTag.get('firstCommunicationAt')) tagUpdate.firstCommunicationAt = normalized.timestamp;
    if (!freshTag.get('batteryStartedAt')) Object.assign(tagUpdate, { batteryStartedAt: normalized.timestamp, batteryStartSource: 'first_communication' });
    if (normalized.timestamp >= Number(freshTag.get('lastPosition.timestamp') || 0)) Object.assign(tagUpdate, { lastPosition: point, lastBattery: point.battery?.level });
    tx.update(tag.ref, tagUpdate);
  });
  return point;
}

async function refreshXadtag(tenantId: string, tagId: string): Promise<SingleTagLocation> {
  const item = await xadTagRepository.get(tenantId, tagId);
  if (!item) throw Object.assign(new Error('XADTAG não encontrada.'), { status: 404 });
  const result = await xadTagService.check(item);
  if (!result.position) throw Object.assign(new Error('O Traccar não retornou uma posição para esta XADTAG.'), { status: 404 });
  const vehicle = await linkedVehicle(tenantId, tagId); const timestamp = trackedTime(result.position) || Date.now();
  const batteryLevel = Number(result.position.attributes?.batteryLevel);
  const batteryInfo = Number.isFinite(batteryLevel)
    ? { level: Math.max(0, Math.min(100, batteryLevel)), label: `${Math.round(batteryLevel)}%`, color: batteryLevel > 60 ? '#10b981' : batteryLevel > 25 ? '#f59e0b' : '#ef4444' }
    : undefined;
  const point: SingleTagLocation = {
    id: String(result.position.id || `${timestamp}-${result.position.latitude}-${result.position.longitude}`),
    tagId, ...(vehicle ? { vehicleId: vehicle.id } : {}), provider: 'traccar', timestamp,
    isodatetime: new Date(timestamp).toISOString(), lat: Number(result.position.latitude), lon: Number(result.position.longitude),
    address: result.position.address || null, speed: result.position.speed, course: result.position.course,
    altitude: result.position.altitude, ...(batteryInfo ? { battery: batteryInfo } : {}),
  };
  await xadTagRepository.persistPosition(item, result.position);
  if (vehicle) await adminDb.runTransaction(async tx => {
    const current = await tx.get(vehicle.ref);
    if (timestamp >= Number(current.get('lastPosition.timestamp') || 0)) tx.update(vehicle.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now() });
  });
  return point;
}

async function execute(tenantId: string, tagId: string) {
  const tag = await adminDb.doc(`tenants/${tenantId}/tags/${tagId}`).get();
  if (!tag.exists) throw Object.assign(new Error('Tag não encontrada.'), { status: 404 });
  const type = String(tag.get('type') || tag.get('equipmentType'));
  if (type === 'XADTAG') return refreshXadtag(tenantId, tagId);
  if (type === 'K_TAG') return refreshKtag(tenantId, tag);
  throw Object.assign(new Error('Tipo de tag não suportado.'), { status: 422 });
}

export function refreshSingleTag(tenantId: string, tagId: string) {
  const key = `${tenantId}:${tagId}`; const current = pending.get(key);
  if (current) return current;
  const request = execute(tenantId, tagId).finally(() => pending.delete(key));
  pending.set(key, request); return request;
}
