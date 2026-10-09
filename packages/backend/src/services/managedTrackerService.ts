import { createHash } from 'node:crypto';
import { adminDb } from './firebaseAdmin.js';
import { traccarClient } from './traccarClient.js';
import type { ManagedTracker, TraccarDevice } from '@ktag/shared';

export type BlockingCommand = { type: string; attributes?: Record<string, string | number | boolean> };
export type BlockingProfile = {
  modelId: string;
  approved: boolean;
  block: BlockingCommand;
  unblock: BlockingCommand;
  verifiedAt?: number;
};

const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });
const trackerRef = (tenantId: string, imei: string) => adminDb.doc(`tenants/${tenantId}/trackers/${imei}`);
const identifierHash = (imei: string) => createHash('sha256').update(imei).digest('hex');

export async function reserveTrackerIdentifier(tenantId: string, imei: string) {
  const ownershipRef = adminDb.doc(`traccar_tracker_identifiers/${imei}`);
  const tagRef = adminDb.doc(`xadtag_identifiers/${identifierHash(imei)}`);
  await adminDb.runTransaction(async tx => {
    const [ownership, tag, ktag] = await Promise.all([tx.get(ownershipRef), tx.get(tagRef), tx.get(adminDb.doc(`traccar_ktag_identifiers/${imei}`))]);
    if (ownership.exists || tag.exists || ktag.exists) throw conflict('IMEI já reservado por outro equipamento.');
    tx.create(ownershipRef, { tenantId, imei, createdAt: Date.now() });
  });
}

export async function releaseTrackerIdentifier(tenantId: string, imei: string) {
  const ref = adminDb.doc(`traccar_tracker_identifiers/${imei}`);
  const snap = await ref.get();
  if (snap.exists && snap.get('tenantId') === tenantId) await ref.delete();
}

export async function getBlockingProfile(modelId: string): Promise<BlockingProfile | null> {
  const snap = await adminDb.doc(`tracker_blocking_profiles/${modelId}`).get();
  if (!snap.exists || snap.get('approved') !== true) return null;
  return snap.data() as BlockingProfile;
}

export async function syncManagedTracker(tenantId: string, imei: string): Promise<ManagedTracker> {
  const ref = trackerRef(tenantId, imei);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Rastreador não encontrado.'), { status: 404 });
  const tracker = snap.data() as ManagedTracker;
  try {
    const ownershipRef = adminDb.doc(`traccar_tracker_identifiers/${imei}`);
    const tagRef = adminDb.doc(`xadtag_identifiers/${identifierHash(imei)}`);
    await adminDb.runTransaction(async tx => {
      const [ownership, tag, ktag] = await Promise.all([tx.get(ownershipRef), tx.get(tagRef), tx.get(adminDb.doc(`traccar_ktag_identifiers/${imei}`))]);
      if (tag.exists || ktag.exists || (ownership.exists && ownership.get('tenantId') !== tenantId)) throw conflict('IMEI já reservado por outro equipamento.');
      if (!ownership.exists) tx.create(ownershipRef, { tenantId, imei, createdAt: Date.now() });
    });
    let device = await traccarClient.findDeviceByUniqueId(imei);
    if (device?.attributes?.tenantSlug && device.attributes.tenantSlug !== tenantId) throw conflict('Dispositivo Traccar pertence a outra empresa.');
    if (device?.attributes?.equipmentType === 'XADTAG') throw conflict('IMEI já utilizado por uma XADTAG.');
    if (!device) device = await traccarClient.createDevice({
      name: `${tenantId} - ${tracker.manufacturer} ${tracker.modelName} - ${imei.slice(-4)}`,
      uniqueId: imei, disabled: false, model: tracker.modelName, category: 'tracker',
      attributes: { tenantSlug: tenantId, equipmentType: 'TRACKER', ktagBlockingEnabled: false },
    });
    else if (device.attributes?.tenantSlug !== tenantId || device.attributes?.ktagBlockingEnabled !== Boolean(tracker.blockingEnabled)) {
      device = await traccarClient.updateDevice(device.id, {
        ...device,
        attributes: { ...(device.attributes || {}), tenantSlug: tenantId, equipmentType: 'TRACKER', ktagBlockingEnabled: Boolean(tracker.blockingEnabled) },
      });
    }
    await adminDb.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (!current.exists) throw conflict('Rastreador removido durante a sincronização.');
      const assignmentId = current.get('activeTrackingAssignmentId');
      const assignmentRef = assignmentId ? adminDb.doc(`tenants/${tenantId}/tracker_assignments/${assignmentId}`) : null;
      const assignment = assignmentRef ? await tx.get(assignmentRef) : null;
      tx.update(ref, { traccarDeviceId: device.id, integrationStatus: 'registered', integrationError: null, updatedAt: Date.now() });
      if (assignment?.exists && assignment.get('trackerId') === imei && assignment.get('endedAt') === null) {
        tx.update(assignment.ref, { traccarDeviceId: device.id });
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Traccar indisponível.';
    await ref.update({ integrationStatus: 'error', integrationError: message.slice(0, 200), updatedAt: Date.now() });
  }
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() } as ManagedTracker;
}

export async function assertTrackerDevice(tenantId: string, tracker: ManagedTracker): Promise<TraccarDevice> {
  if (!Number.isInteger(tracker.traccarDeviceId) || tracker.integrationStatus !== 'registered') throw conflict('Rastreador não sincronizado com o Traccar.');
  const device = await traccarClient.getDevice(tracker.traccarDeviceId!);
  if (device.uniqueId !== tracker.imei || device.attributes?.tenantSlug !== tenantId || device.attributes?.equipmentType !== 'TRACKER') throw conflict('Vínculo com o Traccar não confere.');
  return device;
}
