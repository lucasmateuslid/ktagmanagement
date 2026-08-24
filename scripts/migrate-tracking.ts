/**
 * Migração aditiva de tracking. Dry-run por padrão.
 * Uso: npx tsx scripts/migrate-tracking.ts --tenant=acme [--apply] [--report=/tmp/tracking-report.json]
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createDecipheriv, createHash, createHmac, pbkdf2Sync } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const apply = process.argv.includes('--apply');
const tenantArg = process.argv.find(value => value.startsWith('--tenant='))?.slice(9);
const reportPath = process.argv.find(value => value.startsWith('--report='))?.slice(9);
if (!tenantArg) throw new Error('Informe --tenant=<tenantId>.');
const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
const db = getFirestore(app); const tenantId = tenantArg;
const report: any = { tenantId, dryRun: !apply, startedAt: new Date().toISOString(), changes: [], conflicts: [], warnings: [] };
const normalizeSearch = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const prefixHash = (value: string) => createHmac('sha256', process.env.SEARCH_INDEX_KEY || 'ktag-search-index-v1').update(`${tenantId}:${value}`).digest('hex');
const prefixes = (values: unknown[]) => [...new Set(values.flatMap(value => { const normalized = normalizeSearch(value); return [...new Set([normalized, ...normalized.split(' ')])].flatMap(token => Array.from({ length: token.length }, (_, i) => token.slice(0, i + 1))).filter(token => token.length >= 2); }).map(prefixHash))];
const decrypt = (value: unknown) => {
  const text = String(value || '');
  if (text.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(text)) return text;
  try {
    const raw = Buffer.from(text, 'base64'); const iv = raw.subarray(0, 12); const encrypted = raw.subarray(12, -16); const tag = raw.subarray(-16);
    const key = pbkdf2Sync(`ktag-enterprise-master-key-${tenantId}-v3`, 'ktag-enterprise-salt-2025', 100_000, 32, 'sha256');
    const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return text; }
};

const [tagsSnap, vehiclesSnap, clientsSnap, auditSnap] = await Promise.all([
  db.collection(`tenants/${tenantId}/tags`).get(), db.collection(`tenants/${tenantId}/vehicles`).get(), db.collection(`tenants/${tenantId}/clients`).get(), db.collection(`tenants/${tenantId}/audit_logs`).get(),
]);
const tags = new Map(tagsSnap.docs.map(doc => [doc.id, { ref: doc.ref, ...doc.data() } as any]));
const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ref: doc.ref, documentCreatedAt: doc.createTime.toMillis(), ...doc.data() } as any));
const clients = new Map(clientsSnap.docs.map(doc => [doc.id, doc.data()]));
const vehiclesByTag = new Map<string, any[]>();
const auditTime = (value: any) => typeof value?.toMillis === 'function' ? value.toMillis() : Number(value || 0);
const linkAudits = auditSnap.docs.map(doc => doc.data()).filter(item => item.action === 'LINK' && item.entity === 'VehicleTag');
for (const vehicle of vehicles) if (vehicle.tagId) vehiclesByTag.set(vehicle.tagId, [...(vehiclesByTag.get(vehicle.tagId) || []), vehicle]);
for (const [tagId, linked] of vehiclesByTag) if (linked.length > 1) report.conflicts.push({ type: 'TAG_USED_BY_MULTIPLE_VEHICLES', tagId, vehicleIds: linked.map(v => v.id) });

for (const [tagId, tag] of tags) {
  const updates: any = {};
  if (tag.type === 'XADTAG') {
    const original = String(tag.identifierOriginal || tag.imeiOriginal || tag.imei || tag.accessoryId || '');
    if (!tag.identifierKind) updates.identifierKind = /^\d{10}$/.test(original) ? 'numeric_serial' : /^\d{15}$/.test(original) ? 'imei' : tag.macAddress ? 'mac' : null;
    if (updates.identifierKind === 'numeric_serial' || tag.identifierKind === 'numeric_serial') {
      updates.identifierProfile = 'xadtag_legacy_numeric_10_to_15'; updates.identifierOriginal = original; updates.identifierNormalized = original.padStart(15, '0');
      updates.traccarUniqueId = String(tag.traccarUniqueId || updates.identifierNormalized);
    } else { updates.identifierOriginal = original; updates.identifierNormalized = String(tag.identifierNormalized || original); updates.traccarUniqueId = String(tag.traccarUniqueId || tag.identifierNormalized || original); }
    if (!Number.isInteger(tag.traccarDeviceId)) updates.traccarDeviceId = null;
    if (!['pending', 'registered', 'error'].includes(tag.integrationStatus)) updates.integrationStatus = Number.isInteger(tag.traccarDeviceId) ? 'registered' : 'pending';
  }
  const linked = vehiclesByTag.get(tagId) || [];
  if (linked.length === 1) Object.assign(updates, { status: 'em_uso', linkedEntityType: 'vehicle', linkedEntityId: linked[0].id, linkedEntityName: decrypt(linked[0].plate) || linked[0].model || linked[0].id, linkedAt: tag.linkedAt || Date.now() });
  if (tag.linkedEntityId && linked.length === 0) report.conflicts.push({ type: 'TAG_LINK_WITHOUT_VEHICLE_REFERENCE', tagId, linkedEntityId: tag.linkedEntityId });
  if (Object.values(updates).some(value => value === null) && updates.identifierKind === null) report.conflicts.push({ type: 'UNKNOWN_IDENTIFIER', tagId, original: String(tag.identifierOriginal || tag.imei || '') });
  else if (Object.keys(updates).length) { report.changes.push({ path: tag.ref.path, fields: Object.keys(updates) }); if (apply) await tag.ref.update({ ...updates, updatedAt: Date.now() }); }
}

for (const vehicle of vehicles) {
  const client = clients.get(vehicle.clientId) || {}; const createdAt = Number(vehicle.createdAt || vehicle.documentCreatedAt || Date.now());
  const updates: any = { searchPrefixes: prefixes([decrypt(vehicle.plate), vehicle.model, decrypt((client as any).name)]), ...(vehicle.createdAt ? {} : { createdAt }) };
  if (vehicle.tagId && !tags.has(vehicle.tagId)) report.conflicts.push({ type: 'VEHICLE_REFERENCES_MISSING_TAG', vehicleId: vehicle.id, tagId: vehicle.tagId });
  report.changes.push({ path: vehicle.ref.path, fields: Object.keys(updates) }); if (apply) await vehicle.ref.update({ ...updates, trackingMigratedAt: FieldValue.serverTimestamp() });
}

// Histórico canônico e períodos ativos de vínculo. Operações são idempotentes.
const cutoff = Date.now() - 30 * 86_400_000;
const writer = apply ? db.bulkWriter() : null;
for (const vehicle of vehicles) {
  if (!vehicle.tagId || !tags.has(vehicle.tagId) || (vehiclesByTag.get(vehicle.tagId) || []).length !== 1) continue;
  const tag = tags.get(vehicle.tagId)!;
  const audit = linkAudits.filter(item => item.entityId === vehicle.id && item.tagId === vehicle.tagId).sort((a, b) => auditTime(b.timestamp) - auditTime(a.timestamp))[0];
  const knownStart = auditTime(audit?.timestamp) || Number(tag.linkedAt || 0);
  const startedAt = knownStart || cutoff;
  const assignmentId = createHash('sha256').update(`${tenantId}|${vehicle.id}|${vehicle.tagId}|${startedAt}`).digest('hex').slice(0, 32);
  const assignmentRef = db.doc(`tenants/${tenantId}/tracking_assignments/${assignmentId}`);
  report.changes.push({ path: assignmentRef.path, fields: ['tagId', 'vehicleId', 'startedAt', 'endedAt'], startEstimated: !knownStart });
  if (writer) {
    writer.set(assignmentRef, { tenantId, tagId: vehicle.tagId, vehicleId: vehicle.id, startedAt, endedAt: null, startedBy: null, endedBy: null, endReason: null, startEstimated: !knownStart }, { merge: true });
    writer.update(vehicle.ref, { activeTrackingAssignmentId: assignmentId });
    writer.update(tag.ref, { activeTrackingAssignmentId: assignmentId });
  }

  const legacy = await vehicle.ref.collection('history').where('timestamp', '>=', cutoff).get();
  for (const point of legacy.docs) {
    const data = point.data(); const tagId = String(data.tagId || vehicle.tagId);
    const pointId = point.id || createHash('sha256').update(`${tagId}|${data.timestamp}|${data.lat}|${data.lon}`).digest('hex');
    const target = db.doc(`tenants/${tenantId}/tag_history/${pointId}`);
    report.changes.push({ path: target.path, fields: ['tagId', 'vehicleIdAtCapture', 'timestamp'] });
    if (writer) writer.set(target, { ...data, id: pointId, tagId, vehicleIdAtCapture: vehicle.id, vehicleId: vehicle.id, provider: 'ktag', savedAt: Number(data.savedAt || Date.now()), expiresAt: data.expiresAt || new Date(Date.now() + 30 * 86_400_000) }, { merge: true });
  }
}
if (writer) await writer.close();
report.finishedAt = new Date().toISOString(); report.digest = createHash('sha256').update(JSON.stringify(report.changes)).digest('hex');
if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report, null, 2));
