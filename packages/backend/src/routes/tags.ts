import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { traccarClient, TraccarHttpError } from '../services/traccarClient.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { traccarRealtimeService } from '../services/traccarRealtimeService.js';

export const tagsRouter = Router();
tagsRouter.use(requireAuth);
const tenant = (req: any) => { const value = String(req.tenantId || ''); if (!value || value === 'admin' || value === '__apex__') throw Object.assign(new Error('Empresa inválida.'), { status: 400 }); return value; };
const encrypt = (tid: string, value: unknown) => {
  const text = String(value || ''); if (!text) return text; const iv = randomBytes(12);
  const key = pbkdf2Sync(`ktag-enterprise-master-key-${tid}-v3`, 'ktag-enterprise-salt-2025', 100_000, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');
};
const clean = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

tagsRouter.post('/', requirePermission('ACTION_TAGS_MANAGE', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenant(req); const body = req.body || {}; if (body.type === 'XADTAG') return res.status(400).json({ ok: false, error: 'Use a integração XADTAG para este tipo.' });
    const id = String(body.id || crypto.randomUUID()); const name = String(body.name || '').trim(); const accessoryId = String(body.accessoryId || '').trim();
    if (!name || !accessoryId) return res.status(400).json({ ok: false, error: 'Nome e Serial Number são obrigatórios.' });
    const duplicate = await adminDb.collection(`tenants/${tid}/tags`).where('accessoryId', '==', accessoryId).limit(1).get(); if (!duplicate.empty) return res.status(409).json({ ok: false, error: 'Serial Number já cadastrado.' });
    const tenantDoc = await adminDb.doc(`tenants/${tid}`).get(); const tagLimit = Number(tenantDoc.get('settings.limiteTags') || 0); if (tagLimit > 0) { const count = await adminDb.collection(`tenants/${tid}/tags`).count().get(); if (count.data().count >= tagLimit) return res.status(409).json({ ok: false, error: 'Limite de tags da empresa atingido.' }); }
    const data = clean({ ...body, id: undefined, type: 'K_TAG', name, accessoryId, hashedAdvKey: body.hashedAdvKey ? encrypt(tid, body.hashedAdvKey) : undefined, privateKey: body.privateKey ? encrypt(tid, body.privateKey) : undefined, createdAt: Number(body.createdAt) || Date.now(), updatedAt: Date.now() });
    await adminDb.doc(`tenants/${tid}/tags/${id}`).create(data); await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId: req.authUser!.uid, action: 'CREATE', entity: 'Tag', entityId: id, timestamp: FieldValue.serverTimestamp() });
    res.status(201).json({ ok: true, data: { id, ...body, type: 'K_TAG', name, accessoryId } });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao criar tag.' }); }
});

tagsRouter.put('/:id', requirePermission('ACTION_TAGS_MANAGE', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenant(req); const ref = adminDb.doc(`tenants/${tid}/tags/${req.params.id}`); const current = await ref.get(); if (!current.exists) return res.status(404).json({ ok: false, error: 'Tag não encontrada.' });
    if (current.get('type') === 'XADTAG' || current.get('equipmentType') === 'XADTAG') return res.status(400).json({ ok: false, error: 'Use a integração XADTAG para este tipo.' });
    const body = req.body || {}; const accessoryId = String(body.accessoryId || current.get('accessoryId') || '').trim(); const duplicate = await adminDb.collection(`tenants/${tid}/tags`).where('accessoryId', '==', accessoryId).limit(2).get(); if (duplicate.docs.some(doc => doc.id !== ref.id)) return res.status(409).json({ ok: false, error: 'Serial Number já cadastrado.' });
    const manualBatteryStartedAt = Number(body.batteryStartedAt);
    await ref.update(clean({ name: String(body.name || current.get('name') || '').trim(), accessoryId, powerType: body.powerType, batteryWarrantyYears: body.batteryWarrantyYears, ...(Number.isFinite(manualBatteryStartedAt) && manualBatteryStartedAt > 0 ? { batteryStartedAt: manualBatteryStartedAt, batteryStartSource: 'manual' } : {}), hashedAdvKey: body.hashedAdvKey ? encrypt(tid, body.hashedAdvKey) : undefined, privateKey: body.privateKey ? encrypt(tid, body.privateKey) : undefined, updatedAt: Date.now() }));
    await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId: req.authUser!.uid, action: 'UPDATE', entity: 'Tag', entityId: ref.id, timestamp: FieldValue.serverTimestamp() }); res.json({ ok: true, data: { id: ref.id, ...body, accessoryId } });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao atualizar tag.' }); }
});

tagsRouter.delete('/:id', requirePermission('ACTION_TAGS_MANAGE', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenant(req); const ref = adminDb.doc(`tenants/${tid}/tags/${req.params.id}`); const snap = await ref.get(); if (!snap.exists) return res.status(404).json({ ok: false, error: 'Tag não encontrada.' }); const data = snap.data() || {}; const now = Date.now();
    await ref.update({ deletionStatus: 'pending', deletionRequestedAt: now, deletionRequestedBy: req.authUser!.uid });
    if ((data.type === 'XADTAG' || data.equipmentType === 'XADTAG') && Number.isInteger(data.traccarDeviceId)) {
      try { await traccarClient.deleteDevice(data.traccarDeviceId); } catch (error) {
        if (!(error instanceof TraccarHttpError && error.status === 404)) {
          await ref.update({ deletionStatus: 'error', deletionError: (error as Error).message, deletionLastAttemptAt: Date.now(), updatedAt: Date.now() });
          console.warn(JSON.stringify({ event: 'tag.deletion.queued', tenantId: tid, tagId: ref.id, traccarDeviceId: data.traccarDeviceId, error: (error as Error).message }));
          return res.status(202).json({ ok: true, data: { id: ref.id, pending: true }, message: 'Traccar indisponível. A exclusão foi agendada e será concluída automaticamente.' });
        }
      }
    }
    await adminDb.runTransaction(async tx => {
      const vehicleQuery = await tx.get(adminDb.collection(`tenants/${tid}/vehicles`).where('tagId', '==', ref.id).limit(1)); const vehicle = vehicleQuery.docs[0];
      if (vehicle) { const assignmentId = String(vehicle.get('activeTrackingAssignmentId') || data.activeTrackingAssignmentId || ''); if (assignmentId) { const assignmentRef = adminDb.doc(`tenants/${tid}/tracking_assignments/${assignmentId}`); const assignment = await tx.get(assignmentRef); if (assignment.exists && assignment.get('endedAt') === null) tx.update(assignmentRef, { endedAt: now, endedBy: req.authUser!.uid, endReason: 'tag_deleted' }); } tx.update(vehicle.ref, { tagId: FieldValue.delete(), activeTrackingAssignmentId: null, lastPosition: FieldValue.delete(), updatedAt: now }); }
      tx.set(adminDb.collection(`tenants/${tid}/audit_logs`).doc(), { userId: req.authUser!.uid, action: 'DELETE', entity: 'Tag', entityId: ref.id, providerDeviceDeleted: Boolean(data.traccarDeviceId), timestamp: FieldValue.serverTimestamp() });
    });
    if (data.type === 'XADTAG' || data.equipmentType === 'XADTAG') await xadTagRepository.remove({ id: ref.id, ...data } as any); else await ref.delete();
    await traccarRealtimeService.refreshMapping(); res.json({ ok: true, data: { id: ref.id } });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao excluir tag.' }); }
});
