import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { TraccarPosition } from '@ktag/shared';
import { adminDb } from './firebaseAdmin.js';
import { fetchKtagWithRetry, ktagHistoryPointId, normalizeKtagSnapshot } from './ktagHistoryCapture.js';
import { pairKtagResults } from './ktagFleetUtils.js';
import { makeKtagRefreshItem, syncKtagKeysForTenant } from './ktagKeySyncService.js';
import { resolveServerAddress, samePosition } from './serverAddressResolver.js';
import { traccarClient } from './traccarClient.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { toTrackedPosition } from './xadtagService.js';

const positive = (name: string, fallback: number) => { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) && value > 0 ? value : fallback; };
const RETENTION_MS = positive('KTAG_HISTORY_RETENTION_DAYS', 30) * 86_400_000;
const REQUEST_TIMEOUT_MS = positive('KTAG_REQUEST_TIMEOUT_MS', 30_000);
const BATCH_SIZE = Math.min(50, positive('KTAG_BATCH_SIZE', 50));

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
  error?: string;
};

export type FleetRefreshReport = {
  id: string;
  tenantId: string;
  trigger: 'worker' | 'manual';
  startedAt: number;
  completedAt: number;
  busy: boolean;
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
};

const emptySummary = () => ({ totalVehicles: 0, linkedVehicles: 0, positionsUpdated: 0, addressesResolved: 0, addressesReused: 0, addressesFailed: 0, withoutPosition: 0, errors: 0 });

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
    const latest = await adminDb.doc(`tenants/${tenantId}/job_reports/fleet_refresh_latest`).get();
    if (latest.exists) return { ...(latest.data() as FleetRefreshReport), id, trigger, startedAt, completedAt: Date.now(), busy: true };
    return { id, tenantId, trigger, startedAt, completedAt: Date.now(), busy: true, summary: emptySummary(), vehicles: [], locations: [] };
  }

  try {
    const [tagSnap, vehicleSnap] = await Promise.all([
      adminDb.collection(`tenants/${tenantId}/tags`).get(),
      adminDb.collection(`tenants/${tenantId}/vehicles`).get(),
    ]);
    const summary = { ...emptySummary(), totalVehicles: vehicleSnap.size, linkedVehicles: vehicleSnap.docs.filter(doc => doc.get('tagId')).length };
    const vehicleByTag = new Map(vehicleSnap.docs.filter(doc => doc.get('tagId')).map(doc => [String(doc.get('tagId')), doc]));
    const tagById = new Map(tagSnap.docs.map(doc => [doc.id, doc]));
    const locationByTag = new Map<string, any>();
    const errorsByTag = new Map<string, string>();
    const updatedTags = new Set<string>();
    vehicleSnap.docs.forEach(doc => { const tagId = String(doc.get('tagId') || ''); const position = doc.get('lastPosition'); if (tagId && position) locationByTag.set(tagId, { ...position, id: tagId, tagId, vehicleId: doc.id }); });

    const ktagItems = tagSnap.docs
      .filter(doc => String(doc.get('type') || doc.get('equipmentType')) === 'K_TAG')
      .map(doc => makeKtagRefreshItem(tenantId, doc));
    if (ktagItems.length) {
      try {
        const keySync = await syncKtagKeysForTenant(tenantId, ktagItems);
        console.info(JSON.stringify({ event: 'fleet.ktag.keys_synced', tenantId, ...keySync }));
      } catch (error) {
        console.warn(JSON.stringify({ event: 'fleet.ktag.keys_sync_failed', tenantId, error: (error as Error).message }));
      }
    }
    const readyKtagItems = ktagItems.filter(item => item.hashedAdvKey && item.privateKey);
    ktagItems.filter(item => !item.hashedAdvKey || !item.privateKey).forEach(item => {
      errorsByTag.set(item.doc.id, item.accessoryId
        ? 'Chaves de rastreamento não encontradas para o serial desta K-TAG.'
        : 'Serial Number da K-TAG não cadastrado.');
    });
    const url = process.env.KTAG_API_URL; const username = process.env.KTAG_API_USER; const password = process.env.KTAG_API_PASS;

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
          for (const { item, raw } of pairKtagResults(chunk, Array.isArray(payload?.results) ? payload.results : [])) {
            const normalized = normalizeKtagSnapshot(raw);
            if (!normalized) { errorsByTag.set(item.doc.id, 'K-TAG retornou uma posição inválida.'); continue; }
            seen.add(item.doc.id);
            const previous = item.doc.get('lastPosition');
            const reusableAddress = samePosition(previous, normalized.lat, normalized.lon) ? String(previous?.address || '') : '';
            const freshAddress = await resolveServerAddress(normalized.lat, normalized.lon, reusableAddress || null);
            const resolved = freshAddress.address ? freshAddress : { ...freshAddress, address: reusableAddress || null, provider: reusableAddress ? 'existing' as const : null };
            if (resolved.address) resolved.provider === 'existing' ? summary.addressesReused++ : summary.addressesResolved++; else summary.addressesFailed++;
            const vehicle = vehicleByTag.get(item.doc.id); const pointId = ktagHistoryPointId(item.doc.id, normalized);
            const point = { ...normalized, id: pointId, tagId: item.doc.id, ...(vehicle ? { vehicleId: vehicle.id, vehicleIdAtCapture: vehicle.id } : {}), provider: 'ktag', battery: battery(normalized.status), address: resolved.address, addressResolutionStatus: resolved.address ? 'resolved' : 'failed', addressResolutionProvider: resolved.provider, addressResolvedAt: Date.now() };
            const historyRef = adminDb.doc(`tenants/${tenantId}/tag_history/${pointId}`);
            await adminDb.runTransaction(async tx => {
              const [freshTag, existing, freshVehicle] = await Promise.all([tx.get(item.doc.ref), tx.get(historyRef), vehicle ? tx.get(vehicle.ref) : Promise.resolve(null)]);
              const currentTimestamp = Number(freshVehicle?.get('lastPosition.timestamp') || 0); const captured = Number(freshVehicle?.get('ktagHistoryCapturedThrough') || 0);
              if (!existing.exists) tx.create(historyRef, { ...point, savedAt: Date.now(), expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS) });
              else if (point.address) tx.set(historyRef, { address: point.address, addressResolutionStatus: point.addressResolutionStatus, addressResolutionProvider: point.addressResolutionProvider, addressResolvedAt: point.addressResolvedAt }, { merge: true });
              if (freshVehicle) {
                const vehicleUpdate: Record<string, unknown> = { ktagHistoryCapturedThrough: Math.max(captured, normalized.timestamp) };
                if (normalized.timestamp >= currentTimestamp) Object.assign(vehicleUpdate, { lastPosition: point, lastPositionUpdatedAt: Date.now() });
                tx.update(freshVehicle.ref, vehicleUpdate);
              }
              const tagUpdate: Record<string, unknown> = { updatedAt: Date.now(), ...(freshTag.get('firstCommunicationAt') ? {} : { firstCommunicationAt: normalized.timestamp }), ...(freshTag.get('batteryStartedAt') ? {} : { batteryStartedAt: normalized.timestamp, batteryStartSource: 'first_communication' }) };
              if (normalized.timestamp >= Number(freshTag.get('lastPosition.timestamp') || 0)) Object.assign(tagUpdate, { lastPosition: point, lastBattery: point.battery.level });
              tx.update(item.doc.ref, tagUpdate);
            });
            locationByTag.set(item.doc.id, point); updatedTags.add(item.doc.id); summary.positionsUpdated++;
          }
          chunk.filter(item => !seen.has(item.doc.id)).forEach(item => errorsByTag.set(item.doc.id, 'K-TAG não retornou posição para este equipamento.'));
        } catch (error) {
          const message = (error as Error).message; chunk.forEach(item => errorsByTag.set(item.doc.id, message));
        }
      }
    }

    const xadItems = tagSnap.docs.filter(doc => String(doc.get('type') || doc.get('equipmentType')) === 'XADTAG');
    let traccarPositions = new Map<number, TraccarPosition>(); let traccarError = '';
    if (xadItems.length && traccarClient.safeConfig.configured) {
      try { traccarPositions = new Map((await traccarClient.getLatestPositions()).map(position => [position.deviceId, position])); }
      catch (error) { traccarError = (error as Error).message; }
    }
    for (const item of xadItems) {
      const deviceId = Number(item.get('traccarDeviceId')); const raw = Number.isInteger(deviceId) ? traccarPositions.get(deviceId) : undefined;
      const previous = item.get('lastPosition'); const lat = Number(raw?.latitude ?? previous?.lat ?? previous?.latitude); const lon = Number(raw?.longitude ?? previous?.lon ?? previous?.longitude);
      if (!validCoordinates(lat, lon)) { if (traccarError) errorsByTag.set(item.id, traccarError); continue; }
      const reusableAddress = samePosition(previous, lat, lon) ? String(previous?.address || '') : '';
      const freshAddress = await resolveServerAddress(lat, lon, reusableAddress || null);
      const resolved = freshAddress.address ? freshAddress : { ...freshAddress, address: reusableAddress || null, provider: reusableAddress ? 'existing' as const : null };
      if (resolved.address) resolved.provider === 'existing' ? summary.addressesReused++ : summary.addressesResolved++; else summary.addressesFailed++;
      const vehicle = vehicleByTag.get(item.id); const tracked = raw
        ? { ...toTrackedPosition(raw, resolved.address), addressResolutionStatus: resolved.address ? 'resolved' as const : 'failed' as const, addressResolutionAttempts: resolved.attempts, addressResolutionProvider: resolved.provider, addressResolvedAt: Date.now() }
        : { ...previous, address: resolved.address, addressResolutionStatus: resolved.address ? 'resolved' : 'failed', addressResolutionAttempts: resolved.attempts, addressResolutionProvider: resolved.provider, addressResolvedAt: Date.now() };
      await xadTagRepository.persistPosition({ id: item.id, tenantId, ...item.data() } as any, tracked);
      const timestamp = positionTime(raw || previous) || Date.now();
      const point = Object.fromEntries(Object.entries({ id: String(raw?.id ?? previous?.id ?? `${timestamp}-${lat}-${lon}`), tagId: item.id, ...(vehicle ? { vehicleId: vehicle.id } : {}), provider: 'traccar', timestamp, lat, lon, isodatetime: new Date(timestamp).toISOString(), conf: raw?.valid === false ? 0 : 100, status: 1, address: resolved.address, addressResolvedAt: Date.now(), addressResolutionProvider: resolved.provider, speed: raw?.speed ?? previous?.speed, course: raw?.course ?? previous?.course, altitude: raw?.altitude ?? previous?.altitude }).filter(([, value]) => value !== undefined));
      if (vehicle) await adminDb.runTransaction(async tx => { const current = await tx.get(vehicle.ref); if (timestamp >= Number(current.get('lastPosition.timestamp') || 0)) tx.update(vehicle.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now() }); });
      locationByTag.set(item.id, point); if (raw) { updatedTags.add(item.id); summary.positionsUpdated++; }
    }

    const vehicles: FleetRefreshEntry[] = vehicleSnap.docs.map(vehicle => {
      const tagId = String(vehicle.get('tagId') || ''); const location = tagId ? locationByTag.get(tagId) : null; const error = tagId ? errorsByTag.get(tagId) : undefined;
      const linkedTag = tagId ? tagById.get(tagId) : undefined;
      const tagIdentifier = linkedTag
        ? String(linkedTag.get('identifierOriginal') || linkedTag.get('accessoryId') || linkedTag.get('name') || linkedTag.id)
        : null;
      const status: FleetRefreshEntry['status'] = !tagId ? 'no_tag' : error ? 'error' : !location ? 'no_position' : updatedTags.has(tagId) ? 'updated' : 'unchanged';
      if (status === 'no_position') summary.withoutPosition++; if (status === 'error') summary.errors++;
      return { vehicleId: vehicle.id, plate: String(vehicle.get('plate') || 'Sem placa'), model: String(vehicle.get('model') || ''), tagId: tagId || null, tagIdentifier, provider: location?.provider || null, status, address: location?.address || null, timestamp: location ? positionTime(location) : null, ...(error ? { error } : {}) };
    });
    summary.errors += [...errorsByTag.keys()].filter(tagId => !vehicleByTag.has(tagId)).length;
    const report: FleetRefreshReport = { id, tenantId, trigger, startedAt, completedAt: Date.now(), busy: false, summary, vehicles, locations: [...locationByTag.values()] };
    await adminDb.doc(`tenants/${tenantId}/job_reports/fleet_refresh_latest`).set(report);
    console.info(JSON.stringify({ event: 'fleet.refresh.completed', tenantId, trigger, ...summary }));
    return report;
  } finally {
    await releaseLease(lease);
  }
}

export async function latestTenantFleetRefresh(tenantId: string): Promise<FleetRefreshReport> {
  const [lease, latest] = await Promise.all([
    adminDb.doc(`tenants/${tenantId}/job_leases/fleet_refresh`).get(),
    adminDb.doc(`tenants/${tenantId}/job_reports/fleet_refresh_latest`).get(),
  ]);
  const busy = Number(lease.get('expiresAt') || 0) > Date.now();
  if (latest.exists) return { ...(latest.data() as FleetRefreshReport), busy };
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
