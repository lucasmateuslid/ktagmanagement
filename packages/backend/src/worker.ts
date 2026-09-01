import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDecipheriv, pbkdf2Sync, randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { adminDb } from './services/firebaseAdmin.js';
import { traccarClient, TraccarHttpError } from './services/traccarClient.js';
import { xadTagRepository } from './repositories/xadtagRepository.js';
import { fetchKtagWithRetry, ktagHistoryPointId, normalizeKtagSnapshot } from './services/ktagHistoryCapture.js';

dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });
dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env.local'), override: false });

const positive = (name: string, fallback: number) => { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) && value > 0 ? value : fallback; };
const RETENTION_DAYS = positive('KTAG_HISTORY_RETENTION_DAYS', 30);
const RETENTION_MS = RETENTION_DAYS * 86_400_000;
const POLL_MS = positive('KTAG_POLL_INTERVAL_MS', 30 * 60_000);
const REQUEST_TIMEOUT_MS = positive('KTAG_REQUEST_TIMEOUT_MS', 30_000);
const BATCH_SIZE = Math.min(50, positive('KTAG_BATCH_SIZE', 50));
const decrypt = (tenant: string, value: unknown) => {
  const text = String(value || ''); if (text.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(text)) return text;
  try { const raw = Buffer.from(text, 'base64'); const iv = raw.subarray(0, 12); const encrypted = raw.subarray(12, -16); const tag = raw.subarray(-16); const key = pbkdf2Sync(`ktag-enterprise-master-key-${tenant}-v3`, 'ktag-enterprise-salt-2025', 100_000, 32, 'sha256'); const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'); } catch { return text; }
};
const battery = (status: number) => status === 3 ? { level: 100, label: 'Alto', color: '#10b981' } : status === 2 ? { level: 60, label: 'Médio', color: '#eab308' } : status === 1 ? { level: 30, label: 'Baixo', color: '#f97316' } : { level: 10, label: 'Muito baixo', color: '#ef4444' };

async function acquireLease(tenantId: string) {
  const ref = adminDb.doc(`tenants/${tenantId}/job_leases/ktag_history_vps`); const owner = randomUUID(); const now = Date.now();
  const acquired = await adminDb.runTransaction(async tx => { const current = await tx.get(ref); if (Number(current.get('expiresAt') || 0) > now) return false; tx.set(ref, { owner, acquiredAt: now, expiresAt: now + 25 * 60_000 }); return true; });
  return acquired;
}

async function pollTenant(tenantId: string) {
  if (!await acquireLease(tenantId)) return;
  const [tagSnap, vehicleSnap] = await Promise.all([adminDb.collection(`tenants/${tenantId}/tags`).get(), adminDb.collection(`tenants/${tenantId}/vehicles`).get()]);
  const vehicleByTag = new Map(vehicleSnap.docs.filter(doc => doc.get('tagId')).map(doc => [String(doc.get('tagId')), doc]));
  // A primeira comunicação também precisa ser observada antes do vínculo a um
  // veículo: é esse evento que inicia a vida útil da bateria da K-TAG.
  const tags = tagSnap.docs.filter(doc => String(doc.get('type') || doc.get('equipmentType')) === 'K_TAG').map(doc => ({ doc, hashedAdvKey: decrypt(tenantId, doc.get('hashedAdvKey')), privateKey: decrypt(tenantId, doc.get('privateKey')) })).filter(item => item.hashedAdvKey && item.privateKey);
  const url = process.env.KTAG_API_URL; const username = process.env.KTAG_API_USER; const password = process.env.KTAG_API_PASS; if (!url || !username || !password) throw new Error('Credenciais K-TAG não configuradas no worker.');
  const metrics = { received: 0, valid: 0, saved: 0, duplicated: 0, delayed: 0, rejected: 0 };
  for (let offset = 0; offset < tags.length; offset += BATCH_SIZE) {
    const chunk = tags.slice(offset, offset + BATCH_SIZE);
    const response = await fetchKtagWithRetry(() => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`, 'User-Agent': 'KTagManagerPro/5.1 VPS Worker' }, body: JSON.stringify({ hashed_keys: chunk.map(item => item.hashedAdvKey), priv_keys: chunk.map(item => item.privateKey) }), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }));
    if (!response.ok) throw new Error(`K-TAG respondeu HTTP ${response.status}.`); const payload: any = await response.json(); const byKey = new Map(chunk.map(item => [item.hashedAdvKey, item]));
    for (const raw of Array.isArray(payload?.results) ? payload.results : []) {
      metrics.received++; const item = byKey.get(String(raw.key || '')); const normalized = normalizeKtagSnapshot(raw);
      if (!item || !normalized) { metrics.rejected++; continue; } metrics.valid++;
      const vehicle = vehicleByTag.get(item.doc.id); const id = ktagHistoryPointId(item.doc.id, normalized);
      const point = { ...normalized, id, tagId: item.doc.id, ...(vehicle ? { vehicleId: vehicle.id, vehicleIdAtCapture: vehicle.id } : {}), provider: 'ktag', battery: battery(normalized.status) };
      const historyRef = adminDb.doc(`tenants/${tenantId}/tag_history/${id}`);
      const outcome = await adminDb.runTransaction(async tx => {
        const [freshTag, existing, freshVehicle] = await Promise.all([tx.get(item.doc.ref), tx.get(historyRef), vehicle ? tx.get(vehicle.ref) : Promise.resolve(null)]);
        const currentTimestamp = Number(freshVehicle?.get('lastPosition.timestamp') || 0); const captured = Number(freshVehicle?.get('ktagHistoryCapturedThrough') || 0);
        if (!existing.exists) tx.create(historyRef, { ...point, savedAt: Date.now(), expiresAt: Timestamp.fromMillis(Date.now() + RETENTION_MS) });
        if (freshVehicle) {
          const vehicleUpdate: Record<string, unknown> = { ktagHistoryCapturedThrough: Math.max(captured, normalized.timestamp) };
          if (normalized.timestamp >= currentTimestamp) Object.assign(vehicleUpdate, { lastPosition: point, lastPositionUpdatedAt: Date.now() });
          tx.update(freshVehicle.ref, vehicleUpdate);
        }
        const tagUpdate: Record<string, unknown> = {
          updatedAt: Date.now(),
          ...(freshTag.get('firstCommunicationAt') ? {} : { firstCommunicationAt: normalized.timestamp }),
          ...(freshTag.get('batteryStartedAt') ? {} : { batteryStartedAt: normalized.timestamp, batteryStartSource: 'first_communication' }),
        };
        if (normalized.timestamp >= Number(freshTag.get('lastPosition.timestamp') || 0)) Object.assign(tagUpdate, { lastPosition: point, lastBattery: point.battery.level });
        tx.update(item.doc.ref, tagUpdate);
        return { duplicate: existing.exists, delayed: normalized.timestamp < currentTimestamp };
      });
      if (outcome.duplicate) metrics.duplicated++; else metrics.saved++; if (outcome.delayed) metrics.delayed++;
    }
  }
  console.info(JSON.stringify({ event: 'ktag.worker.tenant_completed', tenantId, tags: tags.length, ...metrics }));
}

async function pollAll() { const tenants = await adminDb.collection('tenants').where('active', '==', true).get(); for (const tenant of tenants.docs) { try { await pollTenant(tenant.id); } catch (error) { console.error(JSON.stringify({ event: 'ktag.worker.tenant_failed', tenantId: tenant.id, error: (error as Error).message })); } } }
async function deleteSnapshotInChunks(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  for (let offset = 0; offset < docs.length; offset += 450) {
    const batch = adminDb.batch();
    docs.slice(offset, offset + 450).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function cleanup() {
  const cutoff = Date.now() - RETENTION_MS;
  const tenants = await adminDb.collection('tenants').where('active', '==', true).get();
  for (const tenant of tenants.docs) {
    const expired = await tenant.ref.collection('tag_history').where('savedAt', '<', cutoff).get();
    await deleteSnapshotInChunks(expired.docs);
    // Compatibilidade até todos os registros antigos por veículo expirarem.
    const vehicles = await tenant.ref.collection('vehicles').get();
    for (const vehicle of vehicles.docs) {
      const legacy = await vehicle.ref.collection('history').where('savedAt', '<', cutoff).get();
      await deleteSnapshotInChunks(legacy.docs);
    }
  }
}

const saoPauloParts = () => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts().filter(part => part.type !== 'literal').map(part => [part.type, part.value]));

async function acquireDailyBillingLease(day: string) {
  const ref = adminDb.doc('system_job_leases/daily_billing_enforcement');
  const now = Date.now(); const owner = randomUUID();
  return adminDb.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.get('completedDay') === day || Number(current.get('leaseUntil') || 0) > now) return false;
    tx.set(ref, { owner, day, acquiredAt: now, leaseUntil: now + 30 * 60_000 }, { merge: true });
    return true;
  });
}

const asMillis = (value: unknown) => value instanceof Timestamp ? value.toMillis() : Number(value || 0);

async function notifySuspendedTenant(tenantId: string) {
  const publicKey = process.env.VAPID_PUBLIC_KEY; const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) { console.warn(JSON.stringify({ event: 'billing.push.skipped', tenantId, reason: 'vapid_not_configured' })); return; }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@ktagfinder.app', publicKey, privateKey);
  const users = await adminDb.collection(`tenants/${tenantId}/users`).where('role', 'in', ['admin', 'admin_tecnico']).get();
  const targets = new Set(users.docs.filter(doc => doc.get('notificationPreferences.billingUpdates') !== false).map(doc => String(doc.get('id') || doc.id)));
  if (!targets.size) return;
  const subscriptions = await adminDb.collection('push_subscriptions').where('tenantId', '==', tenantId).get();
  const payload = JSON.stringify({ title: 'Empresa suspensa por inadimplência', body: 'Seu acesso foi suspenso por fatura em atraso há mais de 7 dias. Regularize para reativar.', url: '/#/billing', icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png' });
  await Promise.all(subscriptions.docs.filter(doc => targets.has(String(doc.get('userId') || ''))).map(async doc => {
    try { await webpush.sendNotification(doc.get('subscription'), payload); }
    catch (error: any) { if (error?.statusCode === 404 || error?.statusCode === 410) await doc.ref.delete(); else console.error(JSON.stringify({ event: 'billing.push.failed', tenantId, error: error?.message || String(error) })); }
  }));
}

async function enforceBilling() {
  const parts = saoPauloParts(); const day = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) * 60 + Number(parts.minute) < 210 || !await acquireDailyBillingLease(day)) return;
  let suspended = 0;
  try {
    const cutoff = Date.now() - 7 * 86_400_000;
    const tenants = await adminDb.collection('tenants').where('billing.status', '==', 'overdue').get();
    for (const tenant of tenants.docs) {
      if (tenant.get('active') === false) continue;
      const invoices = await tenant.ref.collection('invoices').where('status', '==', 'OVERDUE').orderBy('dueDate', 'asc').limit(1).get();
      const oldestOverdue = asMillis(invoices.docs[0]?.get('dueDate'));
      if (!oldestOverdue || oldestOverdue >= cutoff) continue;
      const batch = adminDb.batch(); const now = Date.now();
      batch.update(tenant.ref, { active: false, updatedAt: now });
      batch.set(tenant.ref.collection('public_settings').doc('meta'), { active: false }, { merge: true });
      batch.set(tenant.ref.collection('audit_logs').doc(), { id: randomUUID(), userId: 'VPS_BILLING_WORKER', userName: 'Sistema', userEmail: '', action: 'SUSPEND', entity: 'Tenant', entityId: tenant.id, details: 'Suspensão automática por inadimplência > 7d', timestamp: now });
      batch.set(adminDb.collection('system_audit_logs').doc(), { id: randomUUID(), userId: 'VPS_BILLING_WORKER', userName: 'Sistema', userEmail: '', action: 'SUSPEND', entity: 'Tenant', entityId: tenant.id, details: 'Suspensão automática por inadimplência > 7d', timestamp: now });
      await batch.commit(); await notifySuspendedTenant(tenant.id); suspended++;
    }
    await adminDb.doc('system_job_leases/daily_billing_enforcement').set({ completedDay: day, completedAt: Date.now(), suspended, leaseUntil: 0 }, { merge: true });
    console.info(JSON.stringify({ event: 'billing.enforcement.completed', day, suspended }));
  } catch (error) {
    console.error(JSON.stringify({ event: 'billing.enforcement.failed', day, error: (error as Error).message }));
  }
}
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

console.info(JSON.stringify({ event: 'ktag.worker.started', pollMinutes: POLL_MS / 60_000, retentionDays: RETENTION_DAYS, billingTimeZone: 'America/Sao_Paulo' }));
void pollAll(); void cleanup(); void retryPendingDeletions(); void enforceBilling();
setInterval(() => { void pollAll(); void retryPendingDeletions(); }, POLL_MS);
setInterval(() => void cleanup(), 24 * 3_600_000);
setInterval(() => void enforceBilling(), 15 * 60_000);
process.on('SIGTERM', () => process.exit(0)); process.on('SIGINT', () => process.exit(0));
