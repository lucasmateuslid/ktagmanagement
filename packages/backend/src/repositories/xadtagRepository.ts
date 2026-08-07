import { FieldValue } from 'firebase-admin/firestore';
import type { TrackedPosition, XadTag } from '@ktag/shared';
import { adminDb } from '../services/firebaseAdmin.js';

const collectionPath = (tenantId: string) => `tenants/${tenantId}/tags`;
const uniqueRef = (identifier: string) => adminDb.doc(`xadtag_identifiers/${identifier}`);

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
  async reserveAndCreate(input: Omit<XadTag, 'id'>): Promise<{ item: XadTag; created: boolean }> {
    const docRef = adminDb.collection(collectionPath(input.tenantId)).doc();
    return adminDb.runTransaction(async transaction => {
      const ownership = await transaction.get(uniqueRef(input.identifierNormalized));
      if (ownership.exists) {
        const ownerTenantId = String(ownership.get('tenantId'));
        const equipmentId = String(ownership.get('equipmentId'));
        if (ownerTenantId !== input.tenantId) throw new XadTagConflictError('Esta XADTAG já está vinculada a outra empresa.');
        const existing = await transaction.get(adminDb.doc(`${collectionPath(ownerTenantId)}/${equipmentId}`));
        if (existing.exists) return { item: { id: existing.id, ...existing.data() } as XadTag, created: false };
      }
      transaction.set(uniqueRef(input.identifierNormalized), { tenantId: input.tenantId, equipmentId: docRef.id, traccarDeviceId: input.traccarDeviceId, updatedAt: input.updatedAt });
      transaction.set(docRef, input);
      return { item: { id: docRef.id, ...input }, created: true };
    });
  }
  async update(tenantId: string, id: string, data: Partial<XadTag>) { await adminDb.doc(`${collectionPath(tenantId)}/${id}`).update({ ...data, updatedAt: Date.now() }); }
  async persistPosition(item: XadTag, position: TrackedPosition) {
    await adminDb.doc(`${collectionPath(item.tenantId)}/${item.id}`).update({ lastPosition: position, traccarPositionId: position.id || null, updatedAt: Date.now() });
  }
  async audit(tenantId: string, userId: string, event: string, equipmentId: string | null, result: string) {
    await adminDb.collection(`tenants/${tenantId}/audit_logs`).add({ userId, tenantId, equipmentId, event, action: 'TRACKING', entity: 'XADTAG', result, timestamp: FieldValue.serverTimestamp() });
  }
  async buildDeviceMapping() {
    const snap = await adminDb.collectionGroup('tags').where('equipmentType', '==', 'XADTAG').get();
    return new Map(snap.docs.map(doc => [Number(doc.get('traccarDeviceId')), { tenantId: String(doc.get('tenantId')), equipmentId: doc.id, uniqueId: String(doc.get('identifierNormalized')) }]));
  }
  async findMappingByDeviceId(deviceId: number) {
    const snap = await adminDb.collectionGroup('tags').where('traccarDeviceId', '==', deviceId).where('equipmentType', '==', 'XADTAG').limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { tenantId: String(doc.get('tenantId')), equipmentId: doc.id, uniqueId: String(doc.get('identifierNormalized')) };
  }
}
export const xadTagRepository = new XadTagRepository();
