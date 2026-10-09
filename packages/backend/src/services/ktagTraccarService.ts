import { normalizeEquipmentIdentifier } from '@ktag/shared';
import { adminDb } from './firebaseAdmin.js';
import { traccarClient } from './traccarClient.js';
import { getTraccarConfig } from '../config/traccar.js';
import { createHash } from 'node:crypto';

export const normalizeKtagImei = (value: string) => normalizeEquipmentIdentifier('imei', value).normalized;

/** The IMEI belongs to one tag globally; the Feibao serial remains a separate identifier. */
export async function reconcileKtagTraccar(tenantId: string, tagId: string, imeiInput: string) {
  const imei = normalizeKtagImei(imeiInput);
  const tagRef = adminDb.doc(`tenants/${tenantId}/tags/${tagId}`);
  const ownerRef = adminDb.doc(`traccar_ktag_identifiers/${imei}`);
  const xadRef = adminDb.doc(`xadtag_identifiers/${createHash('sha256').update(imei).digest('hex')}`);
  const trackerRef = adminDb.doc(`traccar_tracker_identifiers/${imei}`);
  await adminDb.runTransaction(async tx => {
    const [tag, owner, xad, tracker] = await Promise.all([tx.get(tagRef), tx.get(ownerRef), tx.get(xadRef), tx.get(trackerRef)]);
    if (!tag.exists || tag.get('type') !== 'K_TAG') throw Object.assign(new Error('K-TAG não encontrada.'), { status: 404 });
    if (owner.exists && (owner.get('tenantId') !== tenantId || owner.get('tagId') !== tagId))
      throw Object.assign(new Error('IMEI já cadastrado em outra K-TAG.'), { status: 409 });
    if (xad.exists || tracker.exists) throw Object.assign(new Error('IMEI já reservado por outro equipamento.'), { status: 409 });
    tx.set(ownerRef, { tenantId, tagId, imei, updatedAt: Date.now() });
    tx.update(tagRef, { imei, traccarUniqueId: imei, integrationStatus: 'pending', updatedAt: Date.now() });
  });
  try {
    const tag = await tagRef.get();
    let device = await traccarClient.findDeviceByUniqueId(imei);
    if (device && (device.attributes?.tenantSlug !== tenantId || device.attributes?.equipmentType !== 'K_TAG' || device.attributes?.equipmentId !== tagId))
      throw Object.assign(new Error('IMEI já pertence a outro dispositivo no Traccar.'), { status: 409 });
    if (!device) device = await traccarClient.createDevice({
      name: `${tenantId} | K-TAG ${String(tag.get('accessoryId') || tagId)}`, uniqueId: imei,
      disabled: false, model: 'K-TAG', category: 'K-TAG',
      attributes: { tenantSlug: tenantId, equipmentType: 'K_TAG', equipmentId: tagId, protocol: 'gt06', platformSource: getTraccarConfig().platformSource },
    });
    await tagRef.update({ traccarDeviceId: device.id, traccarDeviceName: device.name,
      integrationStatus: 'registered', integrationErrorCode: null, lastIntegrationCheckAt: Date.now(), updatedAt: Date.now() });
    return { status: 'registered' as const, deviceId: device.id };
  } catch (error) {
    const conflict = (error as { status?: number }).status === 409;
    await tagRef.update({ integrationStatus: conflict ? 'error' : 'pending', integrationErrorCode: conflict ? 'IDENTIFIER_CONFLICT' : 'TRACCAR_UNAVAILABLE', lastIntegrationCheckAt: Date.now() });
    if (conflict) throw error;
    return { status: 'pending' as const, deviceId: null };
  }
}
