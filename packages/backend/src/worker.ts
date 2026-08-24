import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDecipheriv, createHash, pbkdf2Sync, randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './services/firebaseAdmin.js';
import { traccarClient, TraccarHttpError } from './services/traccarClient.js';
import { xadTagRepository } from './repositories/xadtagRepository.js';

dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });
dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env.local'), override: false });

const THIRTY_DAYS = 30 * 86_400_000; const POLL_MS = 30 * 60_000; const MOVE_THRESHOLD = 0.00005;
const decrypt = (tenant: string, value: unknown) => {
  const text = String(value || ''); if (text.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(text)) return text;
  try { const raw = Buffer.from(text, 'base64'); const iv = raw.subarray(0, 12); const encrypted = raw.subarray(12, -16); const tag = raw.subarray(-16); const key = pbkdf2Sync(`ktag-enterprise-master-key-${tenant}-v3`, 'ktag-enterprise-salt-2025', 100_000, 32, 'sha256'); const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'); } catch { return text; }
};
const battery = (status: number) => status === 3 ? { level: 100, label: 'Alto', color: '#10b981' } : status === 2 ? { level: 60, label: 'Médio', color: '#eab308' } : status === 1 ? { level: 30, label: 'Baixo', color: '#f97316' } : { level: 10, label: 'Muito baixo', color: '#ef4444' };
const moved = (previous: any, next: any) => !previous || Math.abs(Number(previous.lat) - next.lat) > MOVE_THRESHOLD || Math.abs(Number(previous.lon) - next.lon) > MOVE_THRESHOLD;

async function acquireLease(tenantId: string) {
  const ref = adminDb.doc(`tenants/${tenantId}/job_leases/ktag_history_vps`); const owner = randomUUID(); const now = Date.now();
  const acquired = await adminDb.runTransaction(async tx => { const current = await tx.get(ref); if (Number(current.get('expiresAt') || 0) > now) return false; tx.set(ref, { owner, acquiredAt: now, expiresAt: now + 25 * 60_000 }); return true; });
  return acquired;
}

async function pollTenant(tenantId: string) {
  if (!await acquireLease(tenantId)) return;
  const [tagSnap, vehicleSnap] = await Promise.all([adminDb.collection(`tenants/${tenantId}/tags`).get(), adminDb.collection(`tenants/${tenantId}/vehicles`).get()]);
  const vehicleByTag = new Map(vehicleSnap.docs.filter(doc => doc.get('tagId')).map(doc => [String(doc.get('tagId')), doc]));
  const tags = tagSnap.docs.filter(doc => doc.get('type') !== 'XADTAG' && doc.get('equipmentType') !== 'XADTAG' && vehicleByTag.has(doc.id)).map(doc => ({ doc, hashedAdvKey: decrypt(tenantId, doc.get('hashedAdvKey')), privateKey: decrypt(tenantId, doc.get('privateKey')) })).filter(item => item.hashedAdvKey && item.privateKey);
  const url = process.env.KTAG_API_URL; const username = process.env.KTAG_API_USER; const password = process.env.KTAG_API_PASS; if (!url || !username || !password) throw new Error('Credenciais K-TAG não configuradas no worker.');
  for (let offset = 0; offset < tags.length; offset += 50) {
    const chunk = tags.slice(offset, offset + 50); const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`, 'User-Agent': 'KTagManagerPro/5.1 VPS Worker' }, body: JSON.stringify({ hashed_keys: chunk.map(item => item.hashedAdvKey), priv_keys: chunk.map(item => item.privateKey) }), signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`K-TAG respondeu HTTP ${response.status}.`); const payload: any = await response.json(); const byKey = new Map(chunk.map(item => [item.hashedAdvKey, item]));
    for (const raw of Array.isArray(payload?.results) ? payload.results : []) {
      const item = byKey.get(String(raw.key || '')); if (!item || !Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)) continue; const vehicle = vehicleByTag.get(item.doc.id)!;
      const timestamp = Number(raw.timestamp) < 1e12 ? Number(raw.timestamp) * 1000 : Number(raw.timestamp); if (!timestamp) continue;
      const point = { id: '', tagId: item.doc.id, vehicleId: vehicle.id, vehicleIdAtCapture: vehicle.id, provider: 'ktag', lat: Number(raw.lat), lon: Number(raw.lon), conf: Number(raw.conf) || 0, status: Number(raw.status), battery: battery(Number(raw.status)), timestamp, isodatetime: raw.isodatetime || new Date(timestamp).toISOString() };
      const previous = vehicle.get('ktagHistoryLastPosition'); const captured = Number(vehicle.get('ktagHistoryCapturedThrough') || 0); const shouldRecord = moved(previous, point) || !captured || timestamp - captured >= 6 * 3_600_000; const id = createHash('sha256').update(`${item.doc.id}|${timestamp}|${point.lat}|${point.lon}`).digest('hex'); point.id = id;
      await adminDb.runTransaction(async tx => { const freshVehicle = await tx.get(vehicle.ref); if (timestamp < Number(freshVehicle.get('lastPosition.timestamp') || 0)) return; if (shouldRecord) tx.set(adminDb.doc(`tenants/${tenantId}/tag_history/${id}`), { ...point, heartbeat: !moved(previous, point), savedAt: Date.now(), expiresAt: Timestamp.fromMillis(Date.now() + THIRTY_DAYS) }, { merge: false }); tx.update(vehicle.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now(), ...(shouldRecord ? { ktagHistoryCapturedThrough: timestamp, ktagHistoryLastPosition: { lat: point.lat, lon: point.lon, timestamp } } : {}) }); tx.update(item.doc.ref, { lastPosition: point, lastBattery: point.battery.level, updatedAt: Date.now() }); });
    }
  }
}

async function pollAll() { const tenants = await adminDb.collection('tenants').where('active', '==', true).get(); for (const tenant of tenants.docs) { try { await pollTenant(tenant.id); } catch (error) { console.error(JSON.stringify({ event: 'ktag.worker.tenant_failed', tenantId: tenant.id, error: (error as Error).message })); } } }
async function cleanup() { const cutoff = Date.now() - THIRTY_DAYS; const tenants = await adminDb.collection('tenants').where('active', '==', true).get(); for (const tenant of tenants.docs) { const expired = await tenant.ref.collection('tag_history').where('savedAt', '<', cutoff).get(); for (let offset = 0; offset < expired.size; offset += 450) { const batch = adminDb.batch(); expired.docs.slice(offset, offset + 450).forEach(doc => batch.delete(doc.ref)); await batch.commit(); } } }
async function retryPendingDeletions() {
  const tenants = await adminDb.collection('tenants').where('active', '==', true).get();
  for (const tenant of tenants.docs) {
    const pending = await tenant.ref.collection('tags').where('deletionStatus', 'in', ['pending', 'error']).get();
    for (const doc of pending.docs) {
      const data = doc.data(); try {
        if (Number.isInteger(data.traccarDeviceId)) { try { await traccarClient.deleteDevice(data.traccarDeviceId); } catch (error) { if (!(error instanceof TraccarHttpError && error.status === 404)) throw error; } }
        const vehicles = await tenant.ref.collection('vehicles').where('tagId', '==', doc.id).get(); const batch = adminDb.batch(); vehicles.docs.forEach(vehicle => { const assignmentId = String(vehicle.get('activeTrackingAssignmentId') || data.activeTrackingAssignmentId || ''); if (assignmentId) batch.update(tenant.ref.collection('tracking_assignments').doc(assignmentId), { endedAt: Date.now(), endedBy: 'vps-worker', endReason: 'tag_deleted_retry' }); batch.update(vehicle.ref, { tagId: FieldValue.delete(), activeTrackingAssignmentId: null, lastPosition: FieldValue.delete(), updatedAt: Date.now() }); }); await batch.commit();
        if (data.type === 'XADTAG' || data.equipmentType === 'XADTAG') await xadTagRepository.remove({ id: doc.id, ...data } as any); else await doc.ref.delete();
        await tenant.ref.collection('audit_logs').add({ userId: 'vps-worker', action: 'DELETE', entity: 'Tag', entityId: doc.id, result: 'retry_success', timestamp: FieldValue.serverTimestamp() });
      } catch (error) { await doc.ref.update({ deletionStatus: 'error', deletionError: (error as Error).message, deletionLastAttemptAt: Date.now() }); }
    }
  }
}

console.info(JSON.stringify({ event: 'ktag.worker.started', pollMinutes: 30, retentionDays: 30 }));
void pollAll(); void cleanup(); void retryPendingDeletions(); setInterval(() => { void pollAll(); void retryPendingDeletions(); }, POLL_MS); setInterval(() => void cleanup(), 24 * 3_600_000);
process.on('SIGTERM', () => process.exit(0)); process.on('SIGINT', () => process.exit(0));
