import { adminDb } from '../packages/backend/src/services/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

const tenantId = process.argv.find(arg => arg.startsWith('--tenant='))?.slice('--tenant='.length);
if (!tenantId || !/^[A-Za-z0-9_-]+$/.test(tenantId)) throw new Error('Use --tenant=ID. A auditoria é somente leitura.');

const [tags, vehicles, trackers] = await Promise.all([
  adminDb.collection(`tenants/${tenantId}/tags`).get(),
  adminDb.collection(`tenants/${tenantId}/vehicles`).get(),
  adminDb.collection(`tenants/${tenantId}/trackers`).get(),
]);
const issues: Array<{ code: string; tagId?: string; vehicleId?: string; plate?: string; detail?: string }> = [];
const safeRepairs: Array<{ vehicleId: string; expectedTagId: string }> = [];
const tagById = new Map(tags.docs.map(doc => [doc.id, doc]));
const vehicleById = new Map(vehicles.docs.map(doc => [doc.id, doc]));
const seenImei = new Map<string, string>(); const seenDevice = new Map<number, string>();
for (const tag of tags.docs) {
  const imei = String(tag.get('imei') || '');
  if (imei) { const other = seenImei.get(imei); if (other) issues.push({ code: 'DUPLICATE_IMEI', tagId: tag.id, detail: `Também em ${other}; final ${imei.slice(-4)}` }); else seenImei.set(imei, tag.id); }
  const deviceId = Number(tag.get('traccarDeviceId'));
  if (Number.isInteger(deviceId) && deviceId > 0) { const other = seenDevice.get(deviceId); if (other) issues.push({ code: 'DUPLICATE_TRACCAR_DEVICE', tagId: tag.id, detail: `Também em ${other}; deviceId ${deviceId}` }); else seenDevice.set(deviceId, tag.id); }
  const linked = String(tag.get('linkedEntityId') || '');
  if (linked && vehicleById.get(linked)?.get('tagId') !== tag.id) issues.push({ code: 'TAG_LINK_MISMATCH', tagId: tag.id, vehicleId: linked });
  const position = tag.get('lastPosition');
  if (position && position.tagId && position.tagId !== tag.id) issues.push({ code: 'TAG_POSITION_ID_MISMATCH', tagId: tag.id, detail: String(position.tagId) });
  if (position?.address && ['photon', 'openstreetmap', 'existing'].includes(String(position.addressResolutionProvider || '')))
    issues.push({ code: 'LEGACY_ADDRESS_REVIEW', tagId: tag.id, detail: `Provedor ${position.addressResolutionProvider}; conferir coordenadas e endereço antes de confiar no dado antigo.` });
}
for (const tracker of trackers.docs) {
  const deviceId = Number(tracker.get('traccarDeviceId'));
  if (!Number.isInteger(deviceId) || deviceId <= 0) continue;
  const other = seenDevice.get(deviceId);
  if (other) issues.push({ code: 'DUPLICATE_TRACCAR_DEVICE', detail: `Rastreador ${tracker.id} e ${other}; deviceId ${deviceId}` });
  else seenDevice.set(deviceId, `tracker:${tracker.id}`);
}
const linkedTags = new Map<string, string>();
for (const vehicle of vehicles.docs) {
  const plate = String(vehicle.get('plate') || ''); const tagId = String(vehicle.get('tagId') || '');
  if (tagId) {
    if (!tagById.has(tagId)) issues.push({ code: 'MISSING_TAG', vehicleId: vehicle.id, plate, tagId });
    const other = linkedTags.get(tagId); if (other) issues.push({ code: 'TAG_MULTIPLE_VEHICLES', vehicleId: vehicle.id, plate, tagId, detail: `Também em ${other}` }); else linkedTags.set(tagId, vehicle.id);
    const position = vehicle.get('lastPosition');
    const trackerPositionId = vehicle.get('trackerId') ? `tracker:${vehicle.get('trackerId')}` : null;
    if (position && (![tagId, trackerPositionId].includes(position.tagId) || (position.vehicleId && position.vehicleId !== vehicle.id))) {
      issues.push({ code: 'VEHICLE_POSITION_LINK_MISMATCH', vehicleId: vehicle.id, plate, tagId });
      safeRepairs.push({ vehicleId: vehicle.id, expectedTagId: tagId });
    }
    const tagTime = Number(tagById.get(tagId)?.get('lastPosition.timestamp') || 0);
    const vehicleTime = Number(position?.timestamp || 0);
    if (tagTime && vehicleTime && Math.abs(tagTime - vehicleTime) > 15 * 60_000)
      issues.push({ code: 'POSITION_TIME_DIVERGENCE', vehicleId: vehicle.id, plate, tagId, detail: `${Math.round((vehicleTime - tagTime) / 60_000)} min` });
    const tagPoint = tagById.get(tagId)?.get('lastPosition');
    if (tagTime && vehicleTime && Math.abs(tagTime - vehicleTime) <= 15 * 60_000 && tagPoint && position) {
      const lat1 = Number(tagPoint.lat ?? tagPoint.latitude); const lon1 = Number(tagPoint.lon ?? tagPoint.longitude);
      const lat2 = Number(position.lat ?? position.latitude); const lon2 = Number(position.lon ?? position.longitude);
      if ([lat1, lon1, lat2, lon2].every(Number.isFinite)) {
        const radians = Math.PI / 180; const dLat = (lat2 - lat1) * radians; const dLon = (lon2 - lon1) * radians;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(dLon / 2) ** 2;
        const meters = 12_742_000 * Math.asin(Math.min(1, Math.sqrt(a)));
        if (meters > 1000) issues.push({ code: 'POSITION_DISTANCE_DIVERGENCE', vehicleId: vehicle.id, plate, tagId, detail: `${Math.round(meters)} m` });
      }
    }
  }
  const trackerId = String(vehicle.get('trackerId') || '');
  if (trackerId && !trackers.docs.some(doc => doc.id === trackerId && doc.get('vehicleId') === vehicle.id))
    issues.push({ code: 'TRACKER_LINK_MISMATCH', vehicleId: vehicle.id, plate, detail: trackerId });
  const position = vehicle.get('lastPosition');
  if (position?.address && ['photon', 'openstreetmap', 'existing'].includes(String(position.addressResolutionProvider || '')))
    issues.push({ code: 'LEGACY_ADDRESS_REVIEW', vehicleId: vehicle.id, plate, detail: `Provedor ${position.addressResolutionProvider}; conferir endereço antigo.` });
}
let repaired = 0;
if (process.argv.includes('--apply')) {
  for (const repair of safeRepairs) {
    const ref = adminDb.doc(`tenants/${tenantId}/vehicles/${repair.vehicleId}`);
    const changed = await adminDb.runTransaction(async tx => {
      const fresh = await tx.get(ref);
      const point = fresh.get('lastPosition');
      const validIds = [repair.expectedTagId, fresh.get('trackerId') ? `tracker:${fresh.get('trackerId')}` : null];
      if (fresh.get('tagId') !== repair.expectedTagId || !point
        || (validIds.includes(point.tagId) && (!point.vehicleId || point.vehicleId === repair.vehicleId))) return false;
      tx.update(ref, { lastPosition: FieldValue.delete(), lastPositionUpdatedAt: FieldValue.delete() });
      return true;
    });
    if (changed) repaired++;
  }
}
console.log(JSON.stringify({ tenantId, auditedAt: new Date().toISOString(), mode: process.argv.includes('--apply') ? 'apply_safe_repairs' : 'read_only',
  counts: { tags: tags.size, vehicles: vehicles.size, trackers: trackers.size, issues: issues.length, safeRepairCandidates: safeRepairs.length, repaired }, issues }, null, 2));
