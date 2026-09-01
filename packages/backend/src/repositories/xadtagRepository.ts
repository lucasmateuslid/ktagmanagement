import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import type { TrackedPosition, XadTag } from '@ktag/shared';
import { adminDb } from '../services/firebaseAdmin.js';

const collectionPath = (tenantId: string) => `tenants/${tenantId}/tags`;
const key = (value: string) => createHash('sha256').update(value).digest('hex');
const uniqueRef = (uniqueId: string) => adminDb.doc(`xadtag_identifiers/${key(uniqueId)}`);
const localIdentifierRef = (tenantId: string, kind: string, identifier: string) => adminDb.doc(`tenants/${tenantId}/tag_identifier_keys/${key(`${kind}:${identifier}`)}`);

export class XadTagConflictError extends Error {}

export class XadTagRepository {
  async assertAvailable(tenantId: string, identifier: string): Promise<void> {
    const ownership = await uniqueRef(identifier).get();
    if (ownership.exists && String(ownership.get('tenantId')) !== tenantId) throw new XadTagConflictError('Esta XADTAG já está vinculada a outra empresa.');
  }
  async get(tenantId: string, id: string): Promise<XadTag | null> {
    const snap = await adminDb.doc(`${collectionPath(tenantId)}/${id}`).get();
    return snap.exists ? ({ id: snap.id, ...snap.data() } as XadTag) : null;
  }
  async list(tenantId: string): Promise<XadTag[]> {
    const snap = await adminDb.collection(collectionPath(tenantId)).where('equipmentType', '==', 'XADTAG').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as XadTag));
  }
  async findByIdentifier(tenantId: string, identifier: string): Promise<XadTag | null> {
    const snap = await adminDb.collection(collectionPath(tenantId)).where('identifierNormalized', '==', identifier).limit(1).get();
    return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as XadTag);
  }
  async findByUniqueId(tenantId: string, uniqueId: string): Promise<XadTag | null> {
    const snap = await adminDb.collection(collectionPath(tenantId)).where('traccarUniqueId', '==', uniqueId).limit(1).get();
    return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as XadTag);
  }
  async reservePending(input: Omit<XadTag, 'id'>): Promise<{ item: XadTag; created: boolean; ownsLease: boolean }> {
    const docRef = adminDb.collection(collectionPath(input.tenantId)).doc();
    const leaseUntil = Date.now() + 30_000;
    return adminDb.runTransaction(async transaction => {
      const globalRef = uniqueRef(input.traccarUniqueId);
      const identifierRef = localIdentifierRef(input.tenantId, input.identifierKind, input.identifierNormalized);
      const [global, identifier] = await Promise.all([transaction.get(globalRef), transaction.get(identifierRef)]);
      const existingId = global.exists ? String(global.get('equipmentId') || '') : identifier.exists ? String(identifier.get('equipmentId') || '') : '';
      if (global.exists && String(global.get('tenantId')) !== input.tenantId) throw new XadTagConflictError('Este uniqueId já pertence a outra empresa.');
      if (existingId) {
        const existing = await transaction.get(adminDb.doc(`${collectionPath(input.tenantId)}/${existingId}`));
        if (!existing.exists) throw new XadTagConflictError('Reserva de identificador inconsistente; execute a migração de reconciliação.');
        const item = { id: existing.id, ...existing.data() } as XadTag;
        const ownsLease = !item.integrationLeaseUntil || item.integrationLeaseUntil < Date.now();
        if (ownsLease && item.integrationStatus !== 'registered') transaction.update(existing.ref, { integrationLeaseUntil: leaseUntil, updatedAt: Date.now() });
        return { item: { ...item, ...(ownsLease ? { integrationLeaseUntil: leaseUntil } : {}) }, created: false, ownsLease };
      }
      transaction.set(globalRef, { tenantId: input.tenantId, equipmentId: docRef.id, traccarUniqueId: input.traccarUniqueId, updatedAt: Date.now() });
      transaction.set(identifierRef, { equipmentId: docRef.id, identifierKind: input.identifierKind, identifierNormalized: input.identifierNormalized, updatedAt: Date.now() });
      transaction.set(docRef, { ...input, integrationLeaseUntil: leaseUntil });
      return { item: { id: docRef.id, ...input, integrationLeaseUntil: leaseUntil }, created: true, ownsLease: true };
    });
  }
  async reserveAndCreate(input: Omit<XadTag, 'id'>): Promise<{ item: XadTag; created: boolean }> {
    const docRef = adminDb.collection(collectionPath(input.tenantId)).doc();
    return adminDb.runTransaction(async transaction => {
      const ownership = await transaction.get(uniqueRef(input.traccarUniqueId));
      if (ownership.exists) {
        const ownerTenantId = String(ownership.get('tenantId'));
        const equipmentId = String(ownership.get('equipmentId'));
        if (ownerTenantId !== input.tenantId) throw new XadTagConflictError('Esta XADTAG já está vinculada a outra empresa.');
        const existing = await transaction.get(adminDb.doc(`${collectionPath(ownerTenantId)}/${equipmentId}`));
        if (existing.exists) return { item: { id: existing.id, ...existing.data() } as XadTag, created: false };
      }
      transaction.set(uniqueRef(input.traccarUniqueId), { tenantId: input.tenantId, equipmentId: docRef.id, traccarDeviceId: input.traccarDeviceId, updatedAt: input.updatedAt });
      transaction.set(docRef, input);
      return { item: { id: docRef.id, ...input }, created: true };
    });
  }
  async update(tenantId: string, id: string, data: Partial<XadTag>) { await adminDb.doc(`${collectionPath(tenantId)}/${id}`).update({ ...data, updatedAt: Date.now() }); }
  async remove(item: XadTag) {
    const tagRef = adminDb.doc(`${collectionPath(item.tenantId)}/${item.id}`);
    await adminDb.runTransaction(async transaction => {
      const current = await transaction.get(tagRef);
      if (!current.exists) return;
      transaction.delete(tagRef);
      if (item.traccarUniqueId) transaction.delete(uniqueRef(item.traccarUniqueId));
      if (item.identifierKind && item.identifierNormalized) transaction.delete(localIdentifierRef(item.tenantId, item.identifierKind, item.identifierNormalized));
    });
  }
  async replaceIdentity(item: XadTag, data: Partial<XadTag> & Pick<XadTag, 'identifierKind' | 'identifierNormalized' | 'traccarUniqueId'>) {
    const tagRef = adminDb.doc(`${collectionPath(item.tenantId)}/${item.id}`);
    const nextGlobalRef = uniqueRef(data.traccarUniqueId);
    const nextLocalRef = localIdentifierRef(item.tenantId, data.identifierKind, data.identifierNormalized);
    // Registros anteriores à migração podem não ter as chaves de identidade.
    // Nesse caso, não tente gerar hashes com undefined; a nova identidade passa
    // a ser a referência autoritativa e a migração posterior limpa órfãos.
    const oldGlobalRef = item.traccarUniqueId ? uniqueRef(item.traccarUniqueId) : nextGlobalRef;
    const oldLocalRef = item.identifierKind && item.identifierNormalized
      ? localIdentifierRef(item.tenantId, item.identifierKind, item.identifierNormalized)
      : nextLocalRef;
    await adminDb.runTransaction(async transaction => {
      const [tag, nextGlobal, nextLocal, oldGlobal, oldLocal] = await Promise.all([
        transaction.get(tagRef), transaction.get(nextGlobalRef), transaction.get(nextLocalRef),
        transaction.get(oldGlobalRef), transaction.get(oldLocalRef),
      ]);
      if (!tag.exists) throw new Error('XADTAG não encontrada.');
      if (nextGlobal.exists && (String(nextGlobal.get('tenantId')) !== item.tenantId || String(nextGlobal.get('equipmentId')) !== item.id)) {
        throw new XadTagConflictError('O uniqueId correto já pertence a outra XADTAG.');
      }
      if (nextLocal.exists && String(nextLocal.get('equipmentId')) !== item.id) {
        throw new XadTagConflictError('O identificador correto já pertence a outra XADTAG desta empresa.');
      }
      const now = Date.now();
      transaction.set(nextGlobalRef, { tenantId: item.tenantId, equipmentId: item.id, traccarUniqueId: data.traccarUniqueId, traccarDeviceId: data.traccarDeviceId ?? item.traccarDeviceId, updatedAt: now });
      transaction.set(nextLocalRef, { equipmentId: item.id, identifierKind: data.identifierKind, identifierNormalized: data.identifierNormalized, updatedAt: now });
      transaction.update(tagRef, { ...data, updatedAt: now });
      if (oldGlobalRef.path !== nextGlobalRef.path && oldGlobal.exists && String(oldGlobal.get('equipmentId')) === item.id) transaction.delete(oldGlobalRef);
      if (oldLocalRef.path !== nextLocalRef.path && oldLocal.exists && String(oldLocal.get('equipmentId')) === item.id) transaction.delete(oldLocalRef);
    });
  }
  async persistPosition(item: XadTag, position: TrackedPosition) {
    const ref = adminDb.doc(`${collectionPath(item.tenantId)}/${item.id}`);
    await adminDb.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      const previousTime = Date.parse(String(current.get('lastPosition.fixTime') || current.get('lastPosition.serverTime') || '')) || 0;
      const nextTime = Date.parse(String(position.fixTime || position.serverTime || '')) || 0;
      const validCoordinate = Number.isFinite(position.latitude) && Number.isFinite(position.longitude)
        && position.latitude >= -90 && position.latitude <= 90 && position.longitude >= -180 && position.longitude <= 180
        && !(position.latitude === 0 && position.longitude === 0);
      const timestamp = nextTime || Date.now();
      const isBatteryPowered = current.get('powerType') !== '12v';
      const update: Record<string, unknown> = {
        traccarStatus: 'online', communicationValidatedAt: Date.now(), updatedAt: Date.now(),
        ...(validCoordinate && !current.get('firstCommunicationAt') ? { firstCommunicationAt: timestamp } : {}),
        ...(validCoordinate && isBatteryPowered && !current.get('batteryStartedAt') ? { batteryStartedAt: timestamp, batteryStartSource: 'first_communication' } : {}),
      };
      if (nextTime >= previousTime) Object.assign(update, { lastPosition: position, traccarPositionId: position.id || null });
      transaction.update(ref, update);
    });
  }
  async audit(tenantId: string, userId: string, event: string, equipmentId: string | null, result: string) {
    await adminDb.collection(`tenants/${tenantId}/audit_logs`).add({ userId, tenantId, equipmentId, event, action: 'TRACKING', entity: 'XADTAG', result, timestamp: FieldValue.serverTimestamp() });
  }
  async buildDeviceMapping() {
    const snap = await adminDb.collectionGroup('tags').where('equipmentType', '==', 'XADTAG').get();
    return new Map(snap.docs.filter(doc => Number.isInteger(doc.get('traccarDeviceId'))).map(doc => [Number(doc.get('traccarDeviceId')), { tenantId: String(doc.get('tenantId')), equipmentId: doc.id, uniqueId: String(doc.get('traccarUniqueId') || '') }]));
  }
  async findMappingByDeviceId(deviceId: number) {
    const snap = await adminDb.collectionGroup('tags').where('traccarDeviceId', '==', deviceId).where('equipmentType', '==', 'XADTAG').limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { tenantId: String(doc.get('tenantId')), equipmentId: doc.id, uniqueId: String(doc.get('traccarUniqueId') || '') };
  }
}
export const xadTagRepository = new XadTagRepository();
