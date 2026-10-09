import { Timestamp } from 'firebase-admin/firestore';
import type { TraccarPosition } from '@ktag/shared';
import { adminDb } from './firebaseAdmin.js';
import { KtagConfigurationError, ktagClient } from './ktagClient.js';
import { ktagHistoryPointId } from './ktagHistoryCapture.js';
import { makeKtagRefreshItem, syncKtagKeysForTenant } from './ktagKeySyncService.js';
import { shouldSyncKtagKeys } from './ktagFleetUtils.js';
import { resolveServerAddress, reusableAddressAt, samePosition } from './serverAddressResolver.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { xadTagService } from './xadtagService.js';
import { traccarClient } from './traccarClient.js';
import { afterVehicleLink, canPromotePosition, canPromoteVehiclePosition, positionAgeMinutes, validPosition, withoutUndefined } from './currentPosition.js';

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
  const snap = await adminDb.collection(`tenants/${tenantId}/vehicles`).where('tagId', '==', tagId).limit(2).get();
  if (snap.size > 1) throw Object.assign(new Error('Tag vinculada a mais de uma placa. Revise os vínculos.'), { status: 409 });
  return snap.docs[0] || null;
}

async function refreshKtag(tenantId: string, tag: FirebaseFirestore.DocumentSnapshot): Promise<SingleTagLocation> {
  let traccarReason = '';
  if (tag.get('integrationStatus') === 'registered' && Number.isInteger(tag.get('traccarDeviceId'))) {
    let raw: TraccarPosition | null = null;
    try { raw = await traccarClient.getLatestPositionForDevice(Number(tag.get('traccarDeviceId'))); }
    catch (error) { traccarReason = 'Traccar indisponível'; console.warn(JSON.stringify({ event: 'tag.refresh.traccar_fallback', tenantId, tagId: tag.id, error: (error as Error).message })); }
      if (raw && raw.deviceId === Number(tag.get('traccarDeviceId'))) {
        const timestamp = trackedTime(raw);
        const point: SingleTagLocation = withoutUndefined({ id: String(raw.id), tagId: tag.id, provider: 'traccar', timestamp,
          isodatetime: new Date(timestamp || 0).toISOString(), lat: raw.latitude, lon: raw.longitude,
          address: raw.address || null, addressResolutionProvider: raw.address ? 'traccar' : null,
          speed: raw.speed, course: raw.course, altitude: raw.altitude });
        if (raw.valid !== false && validPosition(point)) {
          const vehicle = await linkedVehicle(tenantId, tag.id);
          const accepted = await adminDb.runTransaction(async tx => {
            const [freshTag, freshVehicle] = await Promise.all([tx.get(tag.ref), vehicle ? tx.get(vehicle.ref) : Promise.resolve(null)]);
            if (freshTag.get('traccarDeviceId') !== raw.deviceId) return false;
            if (canPromotePosition(tag.id, point, freshTag.get('lastPosition'))) tx.update(tag.ref, { lastPosition: point, communicationValidatedAt: Date.now(), lastRefreshAttemptAt: Date.now(), lastRefreshStatus: 'success' });
            if (freshVehicle && afterVehicleLink(point.timestamp, freshVehicle.get('trackingLinkedAt')) && canPromoteVehiclePosition(freshVehicle.get('tagId'), freshVehicle.get('trackerId'), point, freshVehicle.get('lastPosition'))) tx.update(freshVehicle.ref, { lastPosition: { ...point, vehicleId: freshVehicle.id }, lastPositionUpdatedAt: Date.now() });
            return true;
          });
          if (!accepted) throw Object.assign(new Error('Cadastro da K-TAG mudou durante a atualização; tente novamente.'), { status: 409 });
          const previous = tag.get('lastPosition');
          return validPosition(previous) && previous.timestamp > point.timestamp ? previous as SingleTagLocation : { ...point, ...(vehicle ? { vehicleId: vehicle.id } : {}) };
        }
      }
    if (!traccarReason) traccarReason = raw ? 'Traccar retornou posição inválida ou de outro dispositivo' : 'K-TAG sem nova resposta no Traccar';
  }
  if (!process.env.KTAG_API_URL || !process.env.KTAG_API_USER || !process.env.KTAG_API_PASS) {
    throw new KtagConfigurationError(traccarReason ? `${traccarReason}; fallback Feibao não configurado.` : 'Integração K-TAG não configurada no backend.');
  }
  const item = makeKtagRefreshItem(tenantId, tag);
  const load = async () => item.hashedAdvKey && item.privateKey
    ? await ktagClient.getLatest([{ hashedKey: item.hashedAdvKey, privateKey: item.privateKey }])
    : null;

  const hadKeys = Boolean(item.hashedAdvKey && item.privateKey);
  const keysAreStale = shouldSyncKtagKeys({ ...item, syncedAt: Number(tag.get('ktagKeysSyncedAt') || 0) });
  if (!hadKeys) await syncKtagKeysForTenant(tenantId, [item]);
  if (!item.hashedAdvKey || !item.privateKey) {
    throw Object.assign(new Error('Chaves de rastreamento não encontradas para o serial desta K-TAG.'), { status: 422 });
  }
  let normalized = await load();
  if (!normalized && hadKeys && keysAreStale) {
    const keySync = await syncKtagKeysForTenant(tenantId, [item]);
    if (keySync.updated) normalized = await load();
  }
  if (!normalized) throw Object.assign(new Error('A Feibao não retornou uma posição para esta K-TAG.'), { status: 404 });

  const vehicle = await linkedVehicle(tenantId, tag.id); const previous = tag.get('lastPosition');
  const reusableAddress = reusableAddressAt(previous, normalized.lat, normalized.lon);
  const address = reusableAddress || null;
  const id = ktagHistoryPointId(tag.id, normalized);
  const point: SingleTagLocation = withoutUndefined({
    ...normalized, id, tagId: tag.id, ...(vehicle ? { vehicleId: vehicle.id } : {}), provider: 'ktag',
    battery: battery(normalized.status), address, addressResolutionStatus: address ? 'resolved' : 'pending',
    addressResolutionProvider: address ? (previous?.addressResolutionProvider || 'traccar') : null,
    addressResolvedAt: address ? Date.now() : null,
    addressVerifiedAt: address && previous?.addressResolutionProvider === 'photon' ? previous.addressVerifiedAt : null,
  });
  const historyRef = adminDb.doc(`tenants/${tenantId}/tag_history/${id}`);
  await adminDb.runTransaction(async tx => {
    const [freshTag, existing, freshVehicle] = await Promise.all([
      tx.get(tag.ref), tx.get(historyRef), vehicle ? tx.get(vehicle.ref) : Promise.resolve(null),
    ]);
    if (!existing.exists) tx.create(historyRef, { ...point, savedAt: Date.now(), expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS) });
    else if (address) tx.set(historyRef, { address, addressResolutionStatus: 'resolved', addressResolutionProvider: 'existing', addressResolvedAt: Date.now() }, { merge: true });
    const sameVehicleTag = freshVehicle?.get('lastPosition.tagId') === tag.id;
    if (freshVehicle && afterVehicleLink(point.timestamp, freshVehicle.get('trackingLinkedAt')) && canPromoteVehiclePosition(freshVehicle.get('tagId'), freshVehicle.get('trackerId'), point, freshVehicle.get('lastPosition'))) {
      tx.update(freshVehicle.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now(), ktagHistoryCapturedThrough: Math.max(sameVehicleTag ? Number(freshVehicle.get('ktagHistoryCapturedThrough') || 0) : 0, normalized.timestamp) });
    }
    const tagUpdate: Record<string, unknown> = { updatedAt: Date.now(), lastRefreshAttemptAt: Date.now(), lastRefreshStatus: 'success' };
    if (!freshTag.get('firstCommunicationAt')) tagUpdate.firstCommunicationAt = normalized.timestamp;
    if (!freshTag.get('batteryStartedAt')) Object.assign(tagUpdate, { batteryStartedAt: normalized.timestamp, batteryStartSource: 'first_communication' });
    if (canPromotePosition(tag.id, point, freshTag.get('lastPosition'))) Object.assign(tagUpdate, { lastPosition: point, lastBattery: point.battery?.level });
    tx.update(tag.ref, tagUpdate);
  });
  if (!address) void resolveServerAddress(normalized.lat, normalized.lon).then(async resolved => {
    if (!resolved.address) return;
    await adminDb.runTransaction(async tx => {
      const [freshTag, freshHistory, freshVehicle] = await Promise.all([
        tx.get(tag.ref), tx.get(historyRef), vehicle ? tx.get(vehicle.ref) : Promise.resolve(null),
      ]);
      const addressUpdate = { address: resolved.address, addressResolutionStatus: 'resolved', addressResolutionProvider: resolved.provider,
        addressResolvedAt: Date.now(), addressVerifiedAt: resolved.provider === 'photon' ? Date.now() : null };
      if (freshHistory.exists && samePosition(freshHistory.data(), normalized.lat, normalized.lon)) tx.set(historyRef, addressUpdate, { merge: true });
      if (freshTag.get('lastPosition.id') === id && samePosition(freshTag.get('lastPosition'), normalized.lat, normalized.lon))
        tx.update(tag.ref, Object.fromEntries(Object.entries(addressUpdate).map(([key, value]) => [`lastPosition.${key}`, value])));
      if (freshVehicle?.get('tagId') === tag.id && freshVehicle.get('lastPosition.id') === id
        && samePosition(freshVehicle.get('lastPosition'), normalized.lat, normalized.lon))
        tx.update(freshVehicle.ref, Object.fromEntries(Object.entries(addressUpdate).map(([key, value]) => [`lastPosition.${key}`, value])));
    });
  }).catch(error => console.warn(JSON.stringify({ event: 'tag.refresh.address_failed', tenantId, tagId: tag.id, error: (error as Error).message })));
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
  const point: SingleTagLocation = withoutUndefined({
    id: String(result.position.id || `${timestamp}-${result.position.latitude}-${result.position.longitude}`),
    tagId, ...(vehicle ? { vehicleId: vehicle.id } : {}), provider: 'traccar', timestamp,
    isodatetime: new Date(timestamp).toISOString(), lat: Number(result.position.latitude), lon: Number(result.position.longitude),
    address: result.position.address || null, speed: result.position.speed, course: result.position.course,
    altitude: result.position.altitude, ...(batteryInfo ? { battery: batteryInfo } : {}),
  });
  await xadTagRepository.persistPosition(item, result.position);
  if (vehicle) await adminDb.runTransaction(async tx => {
    const current = await tx.get(vehicle.ref);
    if (afterVehicleLink(point.timestamp, current.get('trackingLinkedAt')) && canPromoteVehiclePosition(current.get('tagId'), current.get('trackerId'), point, current.get('lastPosition'))) tx.update(vehicle.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now() });
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
  const startedAt = Date.now();
  const request = execute(tenantId, tagId)
    .then(position => {
      console.info(JSON.stringify({ event: 'tag.refresh.completed', tenantId, tagId, provider: position.provider, durationMs: Date.now() - startedAt }));
      return position;
    })
    .catch(error => {
      console.warn(JSON.stringify({ event: 'tag.refresh.failed', tenantId, tagId, durationMs: Date.now() - startedAt, error: (error as Error).message }));
      throw error;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request); return request;
}

export async function refreshSingleTagResult(tenantId: string, tagId: string) {
  const attemptedAt = Date.now();
  const before = await adminDb.doc(`tenants/${tenantId}/tags/${tagId}`).get();
  const previousTime = Number(before.get('lastPosition.timestamp') || 0);
  try {
    const position = await refreshSingleTag(tenantId, tagId);
    const vehicle = await linkedVehicle(tenantId, tagId);
    if (vehicle && !afterVehicleLink(position.timestamp, vehicle.get('trackingLinkedAt')))
      return { position: null, status: 'no_position', attemptedAt, ageMinutes: positionAgeMinutes(position.timestamp), provider: position.provider,
        error: 'Última posição da tag é anterior ao vínculo com este veículo.' };
    return { position, status: position.timestamp > previousTime ? 'updated' : 'unchanged', attemptedAt,
      ageMinutes: positionAgeMinutes(position.timestamp), provider: position.provider };
  } catch (error) {
    const last = before.get('lastPosition');
    const vehicle = await linkedVehicle(tenantId, tagId);
    if (last && validPosition(last) && (!vehicle || afterVehicleLink(last.timestamp, vehicle.get('trackingLinkedAt')))) return { position: last, status: 'error', attemptedAt,
      ageMinutes: positionAgeMinutes(last.timestamp), provider: String((last as { provider?: string }).provider || 'ktag'), error: (error as Error).message };
    throw error;
  }
}
