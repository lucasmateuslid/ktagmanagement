import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { TraccarPosition } from '@ktag/shared';
import { adminDb } from './firebaseAdmin.js';
import { fetchKtagWithRetry, ktagHistoryPointId, normalizeKtagSnapshot } from './ktagHistoryCapture.js';
import { duplicateKtagKeys, pairKtagResults, shouldSyncKtagKeys } from './ktagFleetUtils.js';
import { makeKtagRefreshItem, syncKtagKeysForTenant } from './ktagKeySyncService.js';
import { addressResolverAvailable, displayAddressAt, resolveServerAddress, reusableAddressAt, samePosition } from './serverAddressResolver.js';
import { traccarClient } from './traccarClient.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { toTrackedPosition } from './xadtagService.js';
import { afterVehicleLink, canPromotePosition, canPromoteVehiclePosition, positionAgeMinutes, validPosition, withoutUndefined } from './currentPosition.js';

const positive = (name: string, fallback: number) => { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) && value > 0 ? value : fallback; };
const RETENTION_MS = positive('KTAG_HISTORY_RETENTION_DAYS', 30) * 86_400_000;
const REQUEST_TIMEOUT_MS = positive('KTAG_REQUEST_TIMEOUT_MS', 30_000);
const BATCH_SIZE = Math.min(50, positive('KTAG_BATCH_SIZE', 50));
const ADDRESS_CONCURRENCY = 3;
const ADDRESS_QUEUE_LIMIT = 500;
const POSITION_WRITE_CONCURRENCY = 8;
const addressQueue: Array<() => Promise<void>> = [];
const pendingAddressIds = new Set<string>();
let activeAddressJobs = 0;

async function eachLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  }));
}

function drainAddressQueue() {
  while (activeAddressJobs < ADDRESS_CONCURRENCY && addressQueue.length) {
    const next = addressQueue.shift()!;
    activeAddressJobs++;
    void next().catch(error => console.warn(JSON.stringify({ event: 'fleet.address.persist_failed', error: (error as Error).message }))).finally(() => {
      activeAddressJobs--;
      drainAddressQueue();
    });
  }
}

function queueAddressJob(job: () => Promise<void>) {
  if (addressQueue.length >= ADDRESS_QUEUE_LIMIT) return false;
  addressQueue.push(job);
  drainAddressQueue();
  return true;
}

function resolveKtagAddressLater(
  tagRef: FirebaseFirestore.DocumentReference,
  vehicleRef: FirebaseFirestore.DocumentReference | null,
  historyRef: FirebaseFirestore.DocumentReference,
  point: { id: string; lat: number; lon: number },
) {
  const taskId = `${tagRef.path}:${point.id}`;
  if (!addressResolverAvailable() || pendingAddressIds.has(taskId)) return;
  pendingAddressIds.add(taskId);
  const queued = queueAddressJob(async () => {
    try {
      const resolved = await resolveServerAddress(point.lat, point.lon);
      if (!resolved.address) return;
      await adminDb.runTransaction(async tx => {
        const [tag, history, vehicle] = await Promise.all([tx.get(tagRef), tx.get(historyRef), vehicleRef ? tx.get(vehicleRef) : Promise.resolve(null)]);
        const address = { address: resolved.address, addressResolutionStatus: 'resolved', addressResolutionProvider: resolved.provider,
          addressResolvedAt: Date.now(), addressVerifiedAt: resolved.provider === 'photon' ? Date.now() : null };
        if (history.exists && samePosition(history.data(), point.lat, point.lon)) tx.set(historyRef, address, { merge: true });
        if (tag.get('lastPosition.id') === point.id && samePosition(tag.get('lastPosition'), point.lat, point.lon))
          tx.update(tagRef, Object.fromEntries(Object.entries(address).map(([key, value]) => [`lastPosition.${key}`, value])));
        if (vehicleRef && vehicle?.get('tagId') === tagRef.id && vehicle?.get('lastPosition.id') === point.id
          && samePosition(vehicle.get('lastPosition'), point.lat, point.lon))
          tx.update(vehicleRef, Object.fromEntries(Object.entries(address).map(([key, value]) => [`lastPosition.${key}`, value])));
      });
    } finally {
      pendingAddressIds.delete(taskId);
    }
  });
  if (!queued) {
    pendingAddressIds.delete(taskId);
    console.warn(JSON.stringify({ event: 'fleet.address.queue_full', limit: ADDRESS_QUEUE_LIMIT }));
  }
}

function resolveXadAddressLater(
  tagRef: FirebaseFirestore.DocumentReference,
  vehicleRef: FirebaseFirestore.DocumentReference | null,
  point: { id: string; tagId: string; vehicleId?: string; lat: number; lon: number; timestamp: number },
) {
  if (!addressResolverAvailable()) return;
  const taskId = `${tagRef.path}:${point.id}`;
  if (pendingAddressIds.has(taskId)) return;
  pendingAddressIds.add(taskId);
  if (!queueAddressJob(async () => {
    try {
      const resolved = await resolveServerAddress(point.lat, point.lon);
      if (!resolved.address) return;
      await adminDb.runTransaction(async tx => {
        const [tag, vehicle] = await Promise.all([tx.get(tagRef), vehicleRef ? tx.get(vehicleRef) : Promise.resolve(null)]);
        const address = { address: resolved.address, addressResolutionStatus: 'resolved', addressResolutionProvider: resolved.provider,
          addressResolvedAt: Date.now(), addressVerifiedAt: resolved.provider === 'photon' ? Date.now() : null };
        const tagPosition = tag.get('lastPosition');
        if (String(tagPosition?.id) === point.id && samePosition(tagPosition, point.lat, point.lon)
          && Number(tagPosition?.timestamp ?? positionTime(tagPosition)) === point.timestamp)
          tx.update(tagRef, Object.fromEntries(Object.entries(address).map(([key, value]) => [`lastPosition.${key}`, value])));
        const vehiclePosition = vehicle?.get('lastPosition');
        if (vehicleRef && vehicle?.get('tagId') === point.tagId && String(vehiclePosition?.id) === point.id
          && samePosition(vehiclePosition, point.lat, point.lon) && Number(vehiclePosition?.timestamp) === point.timestamp)
          tx.update(vehicleRef, Object.fromEntries(Object.entries(address).map(([key, value]) => [`lastPosition.${key}`, value])));
      });
    } finally { pendingAddressIds.delete(taskId); }
  })) pendingAddressIds.delete(taskId);
}

export type FleetRefreshEntry = {
  vehicleId: string;
  plate: string;
  model: string;
  tagId: string | null;
  tagIdentifier: string | null;
  provider: 'ktag' | 'traccar' | null;
  status: 'updated' | 'unchanged' | 'no_tag' | 'no_position' | 'error';
  address: string | null;
  timestamp: number | null;
  ageMinutes: number | null;
  attemptedAt: number;
  error?: string;
};

export type FleetRefreshReport = {
  id: string;
  tenantId: string;
  trigger: 'worker' | 'manual';
  startedAt: number;
  completedAt: number;
  busy: boolean;
  error?: string;
  summary: {
    totalVehicles: number;
    linkedVehicles: number;
    positionsUpdated: number;
    addressesResolved: number;
    addressesReused: number;
    addressesFailed: number;
    withoutPosition: number;
    errors: number;
  };
  vehicles: FleetRefreshEntry[];
  locations: any[];
  partsRunId?: string;
  partsCount?: number;
  previousRunId?: string;
};

const emptySummary = () => ({ totalVehicles: 0, linkedVehicles: 0, positionsUpdated: 0, addressesResolved: 0, addressesReused: 0, addressesFailed: 0, withoutPosition: 0, errors: 0 });
const REPORT_PART_SIZE = 100;

export function splitFleetReport(report: FleetRefreshReport) {
  const count = Math.max(Math.ceil(report.vehicles.length / REPORT_PART_SIZE), Math.ceil(report.locations.length / REPORT_PART_SIZE));
  return Array.from({ length: count }, (_, index) => ({
    vehicles: report.vehicles.slice(index * REPORT_PART_SIZE, (index + 1) * REPORT_PART_SIZE),
    locations: report.locations.slice(index * REPORT_PART_SIZE, (index + 1) * REPORT_PART_SIZE),
  }));
}

async function saveFleetRefreshReport(report: FleetRefreshReport) {
  const latestRef = adminDb.doc(`tenants/${report.tenantId}/job_reports/fleet_refresh_latest`);
  const previous = await latestRef.get();
  const parts = splitFleetReport(report);
  const runRef = adminDb.doc(`tenants/${report.tenantId}/fleet_refresh_reports/${report.id}`);
  for (let index = 0; index < parts.length; index += 10) {
    await Promise.all(parts.slice(index, index + 10).map((part, offset) =>
      runRef.collection('parts').doc(String(index + offset).padStart(5, '0')).set(part)));
  }
  const { vehicles: _vehicles, locations: _locations, ...metadata } = report;
  const oldRunId = previous.get('partsRunId');
  const obsoleteRunId = previous.get('previousRunId');
  await latestRef.set({ ...metadata, partsRunId: report.id, partsCount: parts.length,
    previousRunId: oldRunId && oldRunId !== report.id ? oldRunId : null });
  if (obsoleteRunId && obsoleteRunId !== oldRunId && obsoleteRunId !== report.id) {
    void adminDb.recursiveDelete(adminDb.doc(`tenants/${report.tenantId}/fleet_refresh_reports/${obsoleteRunId}`))
      .catch(error => console.warn(JSON.stringify({ event: 'fleet.refresh.old_report_cleanup_failed', tenantId: report.tenantId, error: (error as Error).message })));
  }
}

const battery = (status: number) => status === 0
  ? { level: 100, label: 'Alto', color: '#10b981' }
  : status === 1 ? { level: 60, label: 'Médio', color: '#eab308' }
    : status === 2 ? { level: 30, label: 'Baixo', color: '#f97316' }
      : { level: 10, label: 'Muito baixo', color: '#ef4444' };

async function acquireLease(tenantId: string) {
  const ref = adminDb.doc(`tenants/${tenantId}/job_leases/fleet_refresh`); const owner = randomUUID(); const now = Date.now();
  const acquired = await adminDb.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (Number(current.get('expiresAt') || 0) > now) return false;
    tx.set(ref, { owner, acquiredAt: now, expiresAt: now + 25 * 60_000 });
    return true;
  });
  return acquired ? { ref, owner } : null;
}

async function releaseLease(lease: Awaited<ReturnType<typeof acquireLease>>) {
  if (!lease) return;
  await adminDb.runTransaction(async tx => {
    const current = await tx.get(lease.ref);
    if (current.get('owner') === lease.owner) tx.set(lease.ref, { expiresAt: 0, completedAt: Date.now() }, { merge: true });
  }).catch(() => undefined);
}

const positionTime = (position: any) => Number(position?.timestamp ?? Date.parse(String(position?.fixTime || position?.deviceTime || position?.serverTime || ''))) || 0;
const validCoordinates = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon)
  && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0);

export async function refreshTenantFleet(tenantId: string, trigger: 'worker' | 'manual' = 'worker'): Promise<FleetRefreshReport> {
  const id = randomUUID(); const startedAt = Date.now(); const lease = await acquireLease(tenantId);
  if (!lease) {
    const latest = await latestTenantFleetRefresh(tenantId);
    if (latest) return { ...latest, id, trigger, startedAt, completedAt: Date.now(), busy: true };
    return { id, tenantId, trigger, startedAt, completedAt: Date.now(), busy: true, summary: emptySummary(), vehicles: [], locations: [] };
  }

  const leaseHeartbeat = setInterval(() => {
    void adminDb.runTransaction(async tx => {
      const current = await tx.get(lease.ref);
      if (current.get('owner') === lease.owner) tx.update(lease.ref, { expiresAt: Date.now() + 25 * 60_000, heartbeatAt: Date.now() });
    }).catch(error => console.warn(JSON.stringify({ event: 'fleet.refresh.lease_heartbeat_failed', tenantId, error: (error as Error).message })));
  }, 60_000);
  try {
    const [tagSnap, vehicleSnap, trackerSnap] = await Promise.all([
      adminDb.collection(`tenants/${tenantId}/tags`).get(),
      adminDb.collection(`tenants/${tenantId}/vehicles`).get(),
      adminDb.collection(`tenants/${tenantId}/trackers`).get(),
    ]);
    const summary = { ...emptySummary(), totalVehicles: vehicleSnap.size, linkedVehicles: vehicleSnap.docs.filter(doc => doc.get('tagId') || doc.get('trackerId')).length };
    const vehicleByTag = new Map(vehicleSnap.docs.filter(doc => doc.get('tagId')).map(doc => [String(doc.get('tagId')), doc]));
    const tagById = new Map(tagSnap.docs.map(doc => [doc.id, doc]));
    const locationByTag = new Map<string, any>();
    const errorsByTag = new Map<string, string>();
    const updatedTags = new Set<string>();
    const duplicateAssignments = new Set<string>();
    const assignmentCounts = new Map<string, number>();
    const deviceOwners = new Map<number, string[]>();
    for (const doc of [...tagSnap.docs, ...trackerSnap.docs]) {
      const deviceId = Number(doc.get('traccarDeviceId'));
      if (Number.isInteger(deviceId) && deviceId > 0)
        deviceOwners.set(deviceId, [...(deviceOwners.get(deviceId) || []), doc.ref.path]);
    }
    const duplicateDeviceIds = new Set([...deviceOwners].filter(([, owners]) => owners.length > 1).map(([deviceId]) => deviceId));
    vehicleSnap.docs.forEach(doc => { const tagId = String(doc.get('tagId') || ''); if (tagId) assignmentCounts.set(tagId, (assignmentCounts.get(tagId) || 0) + 1); });
    assignmentCounts.forEach((count, tagId) => { if (count > 1) { duplicateAssignments.add(tagId); errorsByTag.set(tagId, 'K-TAG vinculada a mais de uma placa. Revise os vínculos.'); } });
    vehicleSnap.docs.forEach(doc => { const tagId = String(doc.get('tagId') || ''); const position = doc.get('lastPosition'); if (tagId && !duplicateAssignments.has(tagId) && position?.tagId === tagId && (!position.vehicleId || position.vehicleId === doc.id) && validPosition(position) && afterVehicleLink(position.timestamp, doc.get('trackingLinkedAt'))) locationByTag.set(tagId, { ...position, tagId, vehicleId: doc.id }); });

    let traccarPositions = new Map<number, TraccarPosition>(); let traccarError = '';
    if (!traccarClient.safeConfig.configured && (tagSnap.docs.some(doc => Number.isInteger(doc.get('traccarDeviceId'))) || trackerSnap.docs.some(doc => Number.isInteger(doc.get('traccarDeviceId')))))
      traccarError = 'Integração Traccar não configurada.';
    if ((tagSnap.docs.some(doc => Number.isInteger(doc.get('traccarDeviceId'))) || trackerSnap.docs.some(doc => Number.isInteger(doc.get('traccarDeviceId')))) && traccarClient.safeConfig.configured) {
      try { traccarPositions = new Map((await traccarClient.getLatestPositions()).map(position => [position.deviceId, position])); }
      catch (error) { traccarError = (error as Error).message; }
    }
    const traccarKtags = tagSnap.docs.filter(doc => doc.get('type') === 'K_TAG' && doc.get('integrationStatus') === 'registered' && Number.isInteger(doc.get('traccarDeviceId')));
    const url = process.env.KTAG_API_URL; const username = process.env.KTAG_API_USER; const password = process.env.KTAG_API_PASS;
    const validTraccarKtagIds = new Set<string>();
    await eachLimited(traccarKtags, POSITION_WRITE_CONCURRENCY, async tag => {
      try {
      if (duplicateDeviceIds.has(Number(tag.get('traccarDeviceId')))) {
        errorsByTag.set(tag.id, 'Dispositivo Traccar vinculado a mais de um equipamento. Revise os vínculos.');
        return;
      }
      const raw = traccarPositions.get(Number(tag.get('traccarDeviceId')));
      if (!raw) return;
      const timestamp = positionTime(raw);
      const point = withoutUndefined({ id: String(raw.id), tagId: tag.id, provider: 'traccar', timestamp, lat: Number(raw.latitude), lon: Number(raw.longitude),
        isodatetime: new Date(timestamp || 0).toISOString(), address: raw.address || null, addressResolutionProvider: raw.address ? 'traccar' : null,
        speed: raw.speed, course: raw.course, altitude: raw.altitude });
      if (raw.valid === false || !validPosition(point)) { errorsByTag.set(tag.id, 'Traccar retornou posição inválida para esta K-TAG.'); return; }
      const vehicle = duplicateAssignments.has(tag.id) ? undefined : vehicleByTag.get(tag.id);
      const accepted = await adminDb.runTransaction(async tx => {
        const [freshTag, freshVehicle] = await Promise.all([tx.get(tag.ref), vehicle ? tx.get(vehicle.ref) : Promise.resolve(null)]);
        if (Number(freshTag.get('traccarDeviceId')) !== raw.deviceId) return false;
        if (canPromotePosition(tag.id, point, freshTag.get('lastPosition'))) tx.update(tag.ref, { lastPosition: point, communicationValidatedAt: Date.now(), lastRefreshAttemptAt: Date.now(), lastRefreshStatus: 'success' });
        if (freshVehicle && afterVehicleLink(point.timestamp, freshVehicle.get('trackingLinkedAt')) && canPromoteVehiclePosition(freshVehicle.get('tagId'), freshVehicle.get('trackerId'), point, freshVehicle.get('lastPosition'))) tx.update(freshVehicle.ref, { lastPosition: { ...point, vehicleId: freshVehicle.id }, lastPositionUpdatedAt: Date.now() });
        return true;
      });
      if (!accepted) { errorsByTag.set(tag.id, 'Cadastro da K-TAG mudou durante a atualização; tente novamente.'); return; }
      validTraccarKtagIds.add(tag.id);
      const previous = tag.get('lastPosition');
      const selected = validPosition(previous) && previous.timestamp > point.timestamp ? previous : point;
      locationByTag.set(tag.id, { ...selected, ...(vehicle ? { vehicleId: vehicle.id } : {}) });
      if (!previous || point.timestamp > Number(previous.timestamp || 0)) { updatedTags.add(tag.id); summary.positionsUpdated++; }
      } catch (error) { errorsByTag.set(tag.id, (error as Error).message); }
    });
    const noFallbackKtags = new Set<string>();
    if (!url || !username || !password) traccarKtags.filter(tag => !validTraccarKtagIds.has(tag.id)).forEach(tag => {
      noFallbackKtags.add(tag.id);
      errorsByTag.set(tag.id, traccarError ? 'Traccar indisponível; fallback Feibao não configurado.' : 'K-TAG sem nova resposta no Traccar; fallback Feibao não configurado.');
    });
    const ktagItems = tagSnap.docs
      .filter(doc => String(doc.get('type') || doc.get('equipmentType')) === 'K_TAG')
      .filter(doc => !validTraccarKtagIds.has(doc.id) && !noFallbackKtags.has(doc.id))
      .map(doc => makeKtagRefreshItem(tenantId, doc));
    const keysToSync = ktagItems.filter(item => shouldSyncKtagKeys({ ...item, syncedAt: Number(item.doc.get('ktagKeysSyncedAt') || 0) }));
    if (keysToSync.length) {
      try {
        const keySync = await syncKtagKeysForTenant(tenantId, keysToSync);
        console.info(JSON.stringify({ event: 'fleet.ktag.keys_synced', tenantId, ...keySync }));
      } catch (error) {
        console.warn(JSON.stringify({ event: 'fleet.ktag.keys_sync_failed', tenantId, error: (error as Error).message }));
      }
    }
    const duplicates = duplicateKtagKeys(ktagItems.filter(item => item.hashedAdvKey));
    ktagItems.filter(item => duplicates.has(item.hashedAdvKey)).forEach(item => {
      errorsByTag.set(item.doc.id, 'Chave de rastreamento vinculada a mais de uma K-TAG. Revise o serial e o cadastro.');
    });
    const readyKtagItems = ktagItems.filter(item => item.hashedAdvKey && item.privateKey && !duplicates.has(item.hashedAdvKey));
    ktagItems.filter(item => !item.hashedAdvKey || !item.privateKey).forEach(item => {
      errorsByTag.set(item.doc.id, item.accessoryId
        ? 'Chaves de rastreamento não encontradas para o serial desta K-TAG.'
        : 'Serial Number da K-TAG não cadastrado.');
    });
    if (readyKtagItems.length && (!url || !username || !password)) {
      readyKtagItems.forEach(item => errorsByTag.set(item.doc.id, 'Integração K-TAG não configurada.'));
    } else {
      for (let offset = 0; offset < readyKtagItems.length; offset += BATCH_SIZE) {
        const chunk = readyKtagItems.slice(offset, offset + BATCH_SIZE);
        try {
          const response = await fetchKtagWithRetry(() => fetch(url!, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`, 'User-Agent': 'KTagManagerPro/5.1 FleetRefresh' },
            body: JSON.stringify({ hashed_keys: chunk.map(item => item.hashedAdvKey), priv_keys: chunk.map(item => item.privateKey) }), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          }));
          if (!response.ok) throw new Error(`K-TAG respondeu HTTP ${response.status}.`);
          const payload: any = await response.json();
          const seen = new Set<string>();
          const pairs = pairKtagResults(chunk, Array.isArray(payload?.results) ? payload.results : []);
          let nextPair = 0;
          await Promise.all(Array.from({ length: Math.min(6, pairs.length) }, async () => {
            while (nextPair < pairs.length) {
              const { item, raw } = pairs[nextPair++];
              seen.add(item.doc.id);
              try {
                const normalized = normalizeKtagSnapshot(raw);
                if (!normalized) throw new Error('K-TAG retornou uma posição inválida.');
                const previous = item.doc.get('lastPosition');
                const reusableAddress = reusableAddressAt(previous, normalized.lat, normalized.lon);
                if (reusableAddress) summary.addressesReused++;
                const vehicle = duplicateAssignments.has(item.doc.id) ? undefined : vehicleByTag.get(item.doc.id); const pointId = ktagHistoryPointId(item.doc.id, normalized);
                const point = { ...normalized, id: pointId, tagId: item.doc.id, ...(vehicle ? { vehicleId: vehicle.id, vehicleIdAtCapture: vehicle.id } : {}), provider: 'ktag', battery: battery(normalized.status), address: reusableAddress || null, addressResolutionStatus: reusableAddress ? 'resolved' : 'pending', addressResolutionProvider: reusableAddress ? (previous?.addressResolutionProvider || 'traccar') : null, addressResolvedAt: reusableAddress ? Date.now() : null,
                  addressVerifiedAt: reusableAddress && previous?.addressResolutionProvider === 'photon' ? previous.addressVerifiedAt : null };
                const historyRef = adminDb.doc(`tenants/${tenantId}/tag_history/${pointId}`);
                await adminDb.runTransaction(async tx => {
                  const [freshTag, existing, freshVehicle] = await Promise.all([tx.get(item.doc.ref), tx.get(historyRef), vehicle ? tx.get(vehicle.ref) : Promise.resolve(null)]);
                  const sameTag = freshVehicle?.get('lastPosition.tagId') === item.doc.id;
                  const currentTimestamp = sameTag ? Number(freshVehicle?.get('lastPosition.timestamp') || 0) : 0;
                  const captured = sameTag ? Number(freshVehicle?.get('ktagHistoryCapturedThrough') || 0) : 0;
                  if (!existing.exists) tx.create(historyRef, { ...point, savedAt: Date.now(), expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS) });
                  else if (point.address) tx.set(historyRef, { address: point.address, addressResolutionStatus: point.addressResolutionStatus, addressResolutionProvider: point.addressResolutionProvider, addressResolvedAt: point.addressResolvedAt }, { merge: true });
                  if (freshVehicle?.get('tagId') === item.doc.id) {
                    const vehicleUpdate: Record<string, unknown> = { ktagHistoryCapturedThrough: Math.max(captured, normalized.timestamp) };
                    if (afterVehicleLink(point.timestamp, freshVehicle.get('trackingLinkedAt')) && canPromoteVehiclePosition(freshVehicle.get('tagId'), freshVehicle.get('trackerId'), point, freshVehicle.get('lastPosition'))) Object.assign(vehicleUpdate, { lastPosition: point, lastPositionUpdatedAt: Date.now() });
                    tx.update(freshVehicle.ref, vehicleUpdate);
                  }
                  const tagUpdate: Record<string, unknown> = { updatedAt: Date.now(), ...(freshTag.get('firstCommunicationAt') ? {} : { firstCommunicationAt: normalized.timestamp }), ...(freshTag.get('batteryStartedAt') ? {} : { batteryStartedAt: normalized.timestamp, batteryStartSource: 'first_communication' }) };
                  if (canPromotePosition(item.doc.id, point, freshTag.get('lastPosition'))) Object.assign(tagUpdate, { lastPosition: point, lastBattery: point.battery.level });
                  tx.update(item.doc.ref, tagUpdate);
                });
                const current = locationByTag.get(item.doc.id);
                if (!current || point.timestamp > Number(current.timestamp || 0)) { locationByTag.set(item.doc.id, point); updatedTags.add(item.doc.id); summary.positionsUpdated++; }
                if (!reusableAddress) resolveKtagAddressLater(item.doc.ref, vehicle?.ref || null, historyRef, point);
              } catch (error) {
                errorsByTag.set(item.doc.id, (error as Error).message);
              }
            }
          }));
          chunk.filter(item => !seen.has(item.doc.id)).forEach(item => errorsByTag.set(item.doc.id, 'K-TAG não retornou posição para este equipamento.'));
        } catch (error) {
          const message = (error as Error).message; chunk.forEach(item => errorsByTag.set(item.doc.id, message));
        }
      }
    }

    const xadItems = tagSnap.docs.filter(doc => String(doc.get('type') || doc.get('equipmentType')) === 'XADTAG');
    await eachLimited(xadItems, POSITION_WRITE_CONCURRENCY, async item => {
      try {
      const deviceId = Number(item.get('traccarDeviceId')); const raw = Number.isInteger(deviceId) ? traccarPositions.get(deviceId) : undefined;
      if (duplicateDeviceIds.has(deviceId)) { errorsByTag.set(item.id, 'Dispositivo Traccar vinculado a mais de um equipamento. Revise os vínculos.'); return; }
      if (!raw && traccarError) errorsByTag.set(item.id, traccarError);
      const previous = item.get('lastPosition'); const lat = Number(raw?.latitude ?? previous?.lat ?? previous?.latitude); const lon = Number(raw?.longitude ?? previous?.lon ?? previous?.longitude);
      if (!validCoordinates(lat, lon) || (raw && (raw.valid === false || !positionTime(raw) || positionTime(raw) > Date.now() + 5 * 60_000))) {
        errorsByTag.set(item.id, traccarError || 'Traccar não retornou uma posição válida.'); return;
      }
      const reusableAddress = reusableAddressAt(previous, lat, lon);
      const sourceAddress = typeof raw?.address === 'string' && raw.address.trim() ? raw.address.trim() : '';
      const freshAddress = sourceAddress
        ? { address: sourceAddress, provider: 'traccar' as const, attempts: 0 }
        : { address: reusableAddress || null, provider: reusableAddress ? (previous?.addressResolutionProvider === 'photon' ? 'photon' as const : 'traccar' as const) : null, attempts: 0 };
      const resolved = freshAddress;
      if (resolved.address) sourceAddress ? summary.addressesResolved++ : summary.addressesReused++; else summary.addressesFailed++;
      const vehicle = duplicateAssignments.has(item.id) ? undefined : vehicleByTag.get(item.id); const tracked = raw
        ? { ...toTrackedPosition(raw, resolved.address), addressResolutionStatus: resolved.address ? 'resolved' as const : 'pending' as const, addressResolutionAttempts: resolved.attempts, addressResolutionProvider: resolved.provider, addressResolvedAt: resolved.address ? Date.now() : null,
          addressVerifiedAt: resolved.provider === 'photon' ? previous?.addressVerifiedAt || null : null }
        : { ...previous, address: resolved.address, addressResolutionStatus: resolved.address ? 'resolved' : 'pending', addressResolutionAttempts: resolved.attempts, addressResolutionProvider: resolved.provider, addressResolvedAt: resolved.address ? Date.now() : null };
      await xadTagRepository.persistPosition({ id: item.id, tenantId, ...item.data() } as any, tracked);
      const timestamp = positionTime(raw || previous);
      if (!timestamp) { errorsByTag.set(item.id, 'Posição sem horário válido.'); return; }
      const point = Object.fromEntries(Object.entries({ id: String(raw?.id ?? previous?.id ?? `${timestamp}-${lat}-${lon}`), tagId: item.id, ...(vehicle ? { vehicleId: vehicle.id } : {}), provider: 'traccar', timestamp, lat, lon, isodatetime: new Date(timestamp).toISOString(), conf: raw?.valid === false ? 0 : 100, status: 1, address: resolved.address, addressResolvedAt: resolved.address ? Date.now() : null, addressResolutionProvider: resolved.provider,
        addressVerifiedAt: resolved.provider === 'photon' ? previous?.addressVerifiedAt || null : null, speed: raw?.speed ?? previous?.speed, course: raw?.course ?? previous?.course, altitude: raw?.altitude ?? previous?.altitude }).filter(([, value]) => value !== undefined));
      if (vehicle) await adminDb.runTransaction(async tx => { const current = await tx.get(vehicle.ref); if (afterVehicleLink(timestamp, current.get('trackingLinkedAt')) && canPromoteVehiclePosition(current.get('tagId'), current.get('trackerId'), point as any, current.get('lastPosition'))) tx.update(vehicle.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now() }); });
      if (!resolved.address) resolveXadAddressLater(item.ref, vehicle?.ref || null, point as any);
      const priorLocation = locationByTag.get(item.id);
      if (!priorLocation || timestamp > Number(priorLocation.timestamp || 0)) locationByTag.set(item.id, point);
      if (raw && timestamp > Number(previous?.timestamp || positionTime(previous) || 0)) { updatedTags.add(item.id); summary.positionsUpdated++; }
      } catch (error) { errorsByTag.set(item.id, (error as Error).message); }
    });

    const trackerLocations = new Map<string, any>();
    const updatedTrackers = new Set<string>();
    const trackerErrors = new Map<string, string>();
    const trackerById = new Map(trackerSnap.docs.map(doc => [doc.id, doc]));
    const vehicleByTracker = new Map(vehicleSnap.docs.filter(doc => doc.get('trackerId')).map(doc => [String(doc.get('trackerId')), doc]));
    await eachLimited(trackerSnap.docs, POSITION_WRITE_CONCURRENCY, async tracker => {
      try {
      if (duplicateDeviceIds.has(Number(tracker.get('traccarDeviceId')))) { trackerErrors.set(tracker.id, 'Dispositivo Traccar vinculado a mais de um equipamento. Revise os vínculos.'); return; }
      const linkedVehicle = vehicleByTracker.get(tracker.id);
      const vehicle = linkedVehicle && tracker.get('vehicleId') === linkedVehicle.id ? linkedVehicle : undefined;
      if (!vehicle) return;
      const persisted = tracker.get('lastPosition');
      if (persisted?.tagId === `tracker:${tracker.id}` && persisted?.vehicleId === vehicle.id && validPosition(persisted))
        trackerLocations.set(tracker.id, persisted);
      const raw = traccarPositions.get(Number(tracker.get('traccarDeviceId')));
      if (!raw && traccarError) trackerErrors.set(tracker.id, traccarError);
      const timestamp = raw ? positionTime(raw) : 0;
      if (!raw || raw.valid === false || raw.deviceId !== tracker.get('traccarDeviceId')) return;
      const point = withoutUndefined({ id: String(raw.id), tagId: `tracker:${tracker.id}`, vehicleId: vehicle.id, provider: 'traccar',
        timestamp, lat: Number(raw.latitude), lon: Number(raw.longitude), address: raw.address || null,
        addressResolutionProvider: raw.address ? 'traccar' : null,
        speed: raw.speed, course: raw.course, altitude: raw.altitude });
      if (!validPosition(point)) return;
      if (!persisted || timestamp >= Number(persisted.timestamp || 0)) trackerLocations.set(tracker.id, point);
      const previous = tracker.get('lastPosition');
      if (!previous || timestamp > Number(previous.timestamp || 0)) {
        const promoted = await adminDb.runTransaction(async tx => {
          const [freshTracker, freshVehicle] = await Promise.all([tx.get(tracker.ref), tx.get(vehicle.ref)]);
          if (freshTracker.get('traccarDeviceId') === raw.deviceId && freshTracker.get('vehicleId') === vehicle.id
            && freshVehicle.get('trackerId') === tracker.id && timestamp > Number(freshTracker.get('lastPosition.timestamp') || 0)) {
            tx.update(tracker.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now() });
            if (afterVehicleLink(timestamp, freshVehicle.get('trackingLinkedAt'))
              && canPromoteVehiclePosition(freshVehicle.get('tagId'), freshVehicle.get('trackerId'), point, freshVehicle.get('lastPosition')))
              tx.update(vehicle.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now() });
            return true;
          }
          return false;
        });
        if (promoted) { updatedTrackers.add(tracker.id); summary.positionsUpdated++; }
      }
      } catch (error) { trackerErrors.set(tracker.id, (error as Error).message); }
    });

    const vehicles: FleetRefreshEntry[] = vehicleSnap.docs.map(vehicle => {
      const tagId = String(vehicle.get('tagId') || ''); const candidate = tagId ? locationByTag.get(tagId) : null;
      const tagLocation = candidate && afterVehicleLink(Number(candidate.timestamp || 0), vehicle.get('trackingLinkedAt')) ? candidate : null;
      const trackerId = String(vehicle.get('trackerId') || '');
      const trackerLocation = trackerId && trackerById.get(trackerId)?.get('vehicleId') === vehicle.id ? trackerLocations.get(trackerId) : null;
      const location = trackerLocation && (!tagLocation || trackerLocation.timestamp > tagLocation.timestamp) ? trackerLocation : tagLocation;
      const error = location && location === trackerLocation ? trackerErrors.get(trackerId) : location && location === tagLocation ? errorsByTag.get(tagId)
        : (tagId ? errorsByTag.get(tagId) : undefined) || (trackerId ? trackerErrors.get(trackerId) : undefined);
      const linkedTag = tagId ? tagById.get(tagId) : undefined;
      const tagIdentifier = linkedTag
        ? String(linkedTag.get('identifierOriginal') || linkedTag.get('accessoryId') || linkedTag.get('name') || linkedTag.id)
        : null;
      const status: FleetRefreshEntry['status'] = !tagId && !trackerId ? 'no_tag' : error ? 'error' : !location ? 'no_position'
        : (location === trackerLocation ? updatedTrackers.has(trackerId) : updatedTags.has(tagId)) ? 'updated' : 'unchanged';
      if (status === 'no_position') summary.withoutPosition++; if (status === 'error') summary.errors++;
      const timestamp = location ? positionTime(location) : null;
      return { vehicleId: vehicle.id, plate: String(vehicle.get('plate') || 'Sem placa'), model: String(vehicle.get('model') || ''), tagId: location?.tagId || tagId || (trackerId ? `tracker:${trackerId}` : null),
        tagIdentifier: tagIdentifier || (trackerId || null), provider: location?.provider || null, status, address: displayAddressAt(location),
        timestamp, ageMinutes: positionAgeMinutes(timestamp), attemptedAt: startedAt, ...(error ? { error } : {}) };
    });
    summary.errors += [...errorsByTag.keys()].filter(tagId => !vehicleByTag.has(tagId)).length;
    const report: FleetRefreshReport = { id, tenantId, trigger, startedAt, completedAt: Date.now(), busy: false, summary, vehicles,
      locations: [...locationByTag.entries()].filter(([tagId, point]) => !duplicateAssignments.has(tagId)
        && (!vehicleByTag.has(tagId) || afterVehicleLink(Number(point.timestamp || 0), vehicleByTag.get(tagId)!.get('trackingLinkedAt')))).map(([, point]) => ({ ...point, address: displayAddressAt(point) }))
        .concat([...trackerLocations.values()].map(point => ({ ...point, address: displayAddressAt(point) }))) };
    await saveFleetRefreshReport(report);
    console.info(JSON.stringify({ event: 'fleet.refresh.completed', tenantId, trigger, durationMs: report.completedAt - startedAt, ...summary }));
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha inesperada na atualização.';
    const failed: FleetRefreshReport = { id, tenantId, trigger, startedAt, completedAt: Date.now(), busy: false,
      error: message, summary: emptySummary(), vehicles: [], locations: [] };
    await saveFleetRefreshReport(failed).catch(() => undefined);
    console.error(JSON.stringify({ event: 'fleet.refresh.failed', tenantId, trigger, error: message }));
    throw error;
  } finally {
    clearInterval(leaseHeartbeat);
    await releaseLease(lease);
  }
}

export async function latestTenantFleetRefresh(tenantId: string): Promise<FleetRefreshReport> {
  const [lease, latest] = await Promise.all([
    adminDb.doc(`tenants/${tenantId}/job_leases/fleet_refresh`).get(),
    adminDb.doc(`tenants/${tenantId}/job_reports/fleet_refresh_latest`).get(),
  ]);
  const busy = Number(lease.get('expiresAt') || 0) > Date.now()
    || (latest.get('busy') === true && Date.now() - Number(latest.get('startedAt') || 0) < 30 * 60_000);
  if (latest.exists) {
    const report = latest.data() as FleetRefreshReport;
    if (busy || !report.partsRunId || !report.partsCount) return { ...report, busy, vehicles: report.vehicles || [], locations: report.locations || [] };
    const runRef = adminDb.doc(`tenants/${tenantId}/fleet_refresh_reports/${report.partsRunId}`);
    const parts: Array<{ vehicles: FleetRefreshEntry[]; locations: any[] }> = [];
    for (let index = 0; index < report.partsCount; index += 10) {
      const reads = await Promise.all(Array.from({ length: Math.min(10, report.partsCount - index) }, (_, offset) =>
        runRef.collection('parts').doc(String(index + offset).padStart(5, '0')).get()));
      if (reads.some(part => !part.exists)) throw new Error('Relatório incompleto; tente atualizar novamente.');
      parts.push(...reads.map(part => part.data() as { vehicles: FleetRefreshEntry[]; locations: any[] }));
    }
    return { ...report, busy, vehicles: parts.flatMap(part => part.vehicles), locations: parts.flatMap(part => part.locations) };
  }
  const now = Date.now();
  return { id: randomUUID(), tenantId, trigger: 'manual', startedAt: now, completedAt: now, busy, summary: emptySummary(), vehicles: [], locations: [] };
}

export async function refreshAllActiveTenants() {
  const tenants = await adminDb.collection('tenants').where('active', '==', true).get();
  for (const tenant of tenants.docs) {
    try { await refreshTenantFleet(tenant.id, 'worker'); }
    catch (error) { console.error(JSON.stringify({ event: 'fleet.refresh.failed', tenantId: tenant.id, error: (error as Error).message })); }
  }
}
