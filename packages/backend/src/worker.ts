import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';
import { adminDb } from './services/firebaseAdmin.js';
import { traccarClient, TraccarHttpError } from './services/traccarClient.js';
import { xadTagRepository } from './repositories/xadtagRepository.js';
import { refreshAllActiveTenants } from './services/fleetRefreshService.js';

dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });
dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env.local'), override: false });

const positive = (name: string, fallback: number) => { const value = Number(process.env[name] ?? fallback); return Number.isFinite(value) && value > 0 ? value : fallback; };
const RETENTION_DAYS = positive('KTAG_HISTORY_RETENTION_DAYS', 30);
const RETENTION_MS = RETENTION_DAYS * 86_400_000;
const POLL_MS = positive('KTAG_POLL_INTERVAL_MS', 30 * 60_000);
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

console.info(JSON.stringify({ event: 'fleet.worker.started', pollMinutes: POLL_MS / 60_000, retentionDays: RETENTION_DAYS, billingTimeZone: 'America/Sao_Paulo' }));
void refreshAllActiveTenants(); void cleanup(); void retryPendingDeletions(); void enforceBilling();
setInterval(() => { void refreshAllActiveTenants(); void retryPendingDeletions(); }, POLL_MS);
setInterval(() => void cleanup(), 24 * 3_600_000);
setInterval(() => void enforceBilling(), 15 * 60_000);
process.on('SIGTERM', () => process.exit(0)); process.on('SIGINT', () => process.exit(0));
