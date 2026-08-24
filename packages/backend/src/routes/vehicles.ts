import { Router } from 'express';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { createDecipheriv, createHmac, pbkdf2Sync } from 'node:crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { traccarClient } from '../services/traccarClient.js';
import { xadTagService } from '../services/xadtagService.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { HistoryRequestError, trackingHistoryService } from '../services/trackingHistoryService.js';

export const vehiclesRouter = Router();
vehiclesRouter.use(requireAuth);

const tenantId = (req: any) => {
  const value = String(req.tenantId || '');
  if (!value || value === 'admin' || value === '__apex__') throw Object.assign(new Error('Empresa inválida.'), { status: 400 });
  return value;
};
const normalizeSearch = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
export const searchPrefix = (tenant: string, value: unknown) => createHmac('sha256', process.env.SEARCH_INDEX_KEY || 'ktag-search-index-v1').update(`${tenant}:${normalizeSearch(value)}`).digest('hex');
export const buildSearchPrefixes = (tenant: string, values: unknown[]) => [...new Set(values.flatMap(value => {
  const normalized = normalizeSearch(value); const tokens = [...new Set([normalized, ...normalized.split(' ')])];
  return tokens.flatMap(token => Array.from({ length: token.length }, (_, index) => token.slice(0, index + 1))).filter(token => token.length >= 2);
}).map(value => searchPrefix(tenant, value)))];

function decryptTenantValue(tenant: string, value: unknown): string {
  const text = String(value || '');
  if (text.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(text)) return text;
  try {
    const raw = Buffer.from(text, 'base64'); const iv = raw.subarray(0, 12); const encrypted = raw.subarray(12, -16); const tag = raw.subarray(-16);
    const key = pbkdf2Sync(`ktag-enterprise-master-key-${tenant}-v3`, 'ktag-enterprise-salt-2025', 100_000, 32, 'sha256');
    const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return text; }
}
const vehicleDto = (tenant: string, doc: FirebaseFirestore.DocumentSnapshot) => {
  const value = doc.data() || {};
  return { id: doc.id, ...value, plate: decryptTenantValue(tenant, value.plate), chassis: value.chassis ? decryptTenantValue(tenant, value.chassis) : undefined };
};
const encodeCursor = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decodeCursor = (value: unknown): any => { try { return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8')); } catch { throw Object.assign(new Error('Cursor inválido.'), { status: 400 }); } };
const filtersHash = (query: any) => createHmac('sha256', process.env.SEARCH_INDEX_KEY || 'ktag-search-index-v1').update(JSON.stringify(query)).digest('hex').slice(0, 16);
const matchesFilters = (data: any, filters: Record<string, string>) => (!filters.status || data.status === filters.status)
  && (!filters.companyId || data.companyId === filters.companyId)
  && (!filters.ownershipStatus || data.ownershipStatus === filters.ownershipStatus)
  && (!filters.installationType || data.installationType === filters.installationType)
  && (!filters.tag || (filters.tag === 'linked' ? Boolean(data.tagId) : !data.tagId));

vehiclesRouter.get('/', async (req, res) => {
  try {
    const tid = tenantId(req); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filters = { status: String(req.query.status || ''), companyId: String(req.query.companyId || ''), ownershipStatus: String(req.query.ownershipStatus || ''), installationType: String(req.query.installationType || ''), tag: String(req.query.tag || '') };
    const search = normalizeSearch(req.query.search); const clientId = req.authUser?.role === 'client' ? req.authUser.clientId : null;
    const signature = filtersHash({ filters, search, clientId }); const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (cursor && (cursor.signature !== signature || !Number.isFinite(cursor.createdAt) || typeof cursor.id !== 'string')) throw Object.assign(new Error('Cursor não corresponde aos filtros atuais.'), { status: 400 });
    let query: FirebaseFirestore.Query = adminDb.collection(`tenants/${tid}/vehicles`);
    if (clientId) query = query.where('clientId', '==', clientId);
    else if (search) query = query.where('searchPrefixes', 'array-contains', searchPrefix(tid, search));
    query = query.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
    const direction = req.query.direction === 'previous' ? 'previous' : 'next';
    if (cursor) query = direction === 'previous' ? query.endBefore(cursor.createdAt, cursor.id) : query.startAfter(cursor.createdAt, cursor.id);
    const pageDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []; let scanCursor = cursor; let exhausted = false;
    while (pageDocs.length < limit + 1 && !exhausted) {
      let scan = query;
      if (scanCursor && scanCursor !== cursor) scan = direction === 'previous' ? scan.endBefore(scanCursor.createdAt, scanCursor.id) : scan.startAfter(scanCursor.createdAt, scanCursor.id);
      const batchSize = Math.max(50, limit * 2);
      const snap = await (direction === 'previous' ? scan.limitToLast(batchSize) : scan.limit(batchSize)).get();
      if (snap.empty) { exhausted = true; break; }
      for (const doc of snap.docs) {
        if (matchesFilters(doc.data(), filters)) pageDocs.push(doc);
        if (pageDocs.length >= limit + 1) break;
      }
      const boundary = direction === 'previous' ? snap.docs[0] : snap.docs.at(-1);
      scanCursor = boundary ? { createdAt: Number(boundary.get('createdAt') || 0), id: boundary.id } : scanCursor;
      exhausted = snap.size < batchSize;
    }
    const candidates = direction === 'previous' ? pageDocs.slice(-(limit + 1)) : pageDocs;
    const hasExtra = candidates.length > limit;
    const itemsDocs = direction === 'previous' ? candidates.slice(hasExtra ? 1 : 0) : candidates.slice(0, limit);
    const first = itemsDocs[0]; const last = itemsDocs.at(-1);
    const makeCursor = (doc?: FirebaseFirestore.QueryDocumentSnapshot) => doc ? encodeCursor({ createdAt: Number(doc.get('createdAt') || 0), id: doc.id, signature }) : null;
    const hasNextPage = direction === 'previous' ? Boolean(cursor) : Boolean(last && (hasExtra || !exhausted));
    const hasPreviousPage = direction === 'previous' ? Boolean(first && (hasExtra || !exhausted)) : Boolean(first && cursor);
    res.json({ ok: true, data: { items: itemsDocs.map(doc => vehicleDto(tid, doc)), nextCursor: hasNextPage && last ? makeCursor(last) : null, previousCursor: hasPreviousPage && first ? makeCursor(first) : null, hasNextPage, hasPreviousPage, pageSize: limit } });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao listar veículos.' }); }
});

vehiclesRouter.put('/:vehicleId/tag', requirePermission('ROUTE_VEHICLES', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenantId(req); const vehicleId = String(req.params.vehicleId); const tagId = String(req.body?.tagId || '');
    if (!tagId) return res.status(400).json({ ok: false, error: 'tagId é obrigatório.' });
    const vehicleRef = adminDb.doc(`tenants/${tid}/vehicles/${vehicleId}`); const tagRef = adminDb.doc(`tenants/${tid}/tags/${tagId}`); const auditRef = adminDb.collection(`tenants/${tid}/audit_logs`).doc();
    await adminDb.runTransaction(async tx => {
      const [vehicle, tag, occupied] = await Promise.all([tx.get(vehicleRef), tx.get(tagRef), tx.get(adminDb.collection(`tenants/${tid}/vehicles`).where('tagId', '==', tagId).limit(2))]);
      if (!vehicle.exists || !tag.exists) throw Object.assign(new Error('Veículo ou tag não encontrado.'), { status: 404 });
      const conflicting = occupied.docs.find(doc => doc.id !== vehicleId); if (conflicting) throw Object.assign(new Error('Tag já vinculada a outro veículo.'), { status: 409 });
      const previousTagId = String(vehicle.get('tagId') || ''); let previousTag: FirebaseFirestore.DocumentSnapshot | null = null;
      if (previousTagId && previousTagId !== tagId) previousTag = await tx.get(adminDb.doc(`tenants/${tid}/tags/${previousTagId}`));
      if (tag.get('linkedEntityId') && tag.get('linkedEntityId') !== vehicleId) throw Object.assign(new Error('Tag já vinculada a outro veículo.'), { status: 409 });
      const now = Date.now(); const plate = decryptTenantValue(tid, vehicle.get('plate'));
      const currentAssignmentId = String(vehicle.get('activeTrackingAssignmentId') || '');
      const currentAssignmentRef = currentAssignmentId ? adminDb.doc(`tenants/${tid}/tracking_assignments/${currentAssignmentId}`) : null;
      const currentAssignment = currentAssignmentRef ? await tx.get(currentAssignmentRef) : null;
      if (previousTagId === tagId && currentAssignment?.exists && currentAssignment.get('endedAt') === null) return;
      if (currentAssignment?.exists && currentAssignment.get('endedAt') === null) tx.update(currentAssignment.ref, { endedAt: now, endedBy: req.authUser!.uid, endReason: 'replaced' });
      if (previousTag?.exists) tx.update(previousTag.ref, { status: 'disponível', linkedEntityType: null, linkedEntityId: null, linkedEntityName: null, linkedAt: null, linkedBy: null, activeTrackingAssignmentId: null, updatedAt: now });
      const assignmentRef = adminDb.collection(`tenants/${tid}/tracking_assignments`).doc();
      tx.set(assignmentRef, { tenantId: tid, tagId, vehicleId, startedAt: now, endedAt: null, startedBy: req.authUser!.uid, endedBy: null, endReason: null, startEstimated: false });
      const newPosition = tag.get('lastPosition');
      tx.update(vehicleRef, { tagId, activeTrackingAssignmentId: assignmentRef.id, updatedAt: now, updatedBy: req.authUser!.uid, ...(newPosition ? { lastPosition: { ...newPosition, tagId } } : { lastPosition: FieldValue.delete() }) });
      tx.update(tagRef, { status: 'em_uso', linkedEntityType: 'vehicle', linkedEntityId: vehicleId, linkedEntityName: plate, linkedAt: now, linkedBy: req.authUser!.uid, activeTrackingAssignmentId: assignmentRef.id, updatedAt: now });
      tx.set(auditRef, { userId: req.authUser!.uid, tenantId: tid, action: 'LINK', entity: 'VehicleTag', entityId: vehicleId, tagId, previousTagId: previousTagId || null, timestamp: FieldValue.serverTimestamp() });
    });
    res.json({ ok: true, data: { vehicleId, tagId } });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao vincular tag.' }); }
});

vehiclesRouter.delete('/:vehicleId/tag', requirePermission('ROUTE_VEHICLES', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenantId(req); const vehicleRef = adminDb.doc(`tenants/${tid}/vehicles/${req.params.vehicleId}`); const auditRef = adminDb.collection(`tenants/${tid}/audit_logs`).doc(); const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ ok: false, error: 'Motivo do desvínculo é obrigatório.' });
    await adminDb.runTransaction(async tx => {
      const vehicle = await tx.get(vehicleRef); if (!vehicle.exists) throw Object.assign(new Error('Veículo não encontrado.'), { status: 404 });
      const tagId = String(vehicle.get('tagId') || ''); const tagRef = tagId ? adminDb.doc(`tenants/${tid}/tags/${tagId}`) : null; const tag = tagRef ? await tx.get(tagRef) : null; const now = Date.now();
      const assignmentId = String(vehicle.get('activeTrackingAssignmentId') || tag?.get('activeTrackingAssignmentId') || '');
      const assignment = assignmentId ? await tx.get(adminDb.doc(`tenants/${tid}/tracking_assignments/${assignmentId}`)) : null;
      if (assignment?.exists && assignment.get('endedAt') === null) tx.update(assignment.ref, { endedAt: now, endedBy: req.authUser!.uid, endReason: reason });
      tx.update(vehicleRef, { tagId: FieldValue.delete(), activeTrackingAssignmentId: null, lastPosition: FieldValue.delete(), updatedAt: now, updatedBy: req.authUser!.uid });
      if (tag?.exists) tx.update(tag.ref, { status: 'disponível', linkedEntityType: null, linkedEntityId: null, linkedEntityName: null, linkedAt: null, linkedBy: null, activeTrackingAssignmentId: null, updatedAt: now });
      tx.set(auditRef, { userId: req.authUser!.uid, tenantId: tid, action: 'UNLINK', entity: 'VehicleTag', entityId: req.params.vehicleId, tagId: tagId || null, reason, timestamp: FieldValue.serverTimestamp() });
    });
    res.json({ ok: true, data: { vehicleId: req.params.vehicleId } });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao desvincular tag.' }); }
});

async function authorizedVehicle(req: any) {
  const tid = tenantId(req); const doc = await adminDb.doc(`tenants/${tid}/vehicles/${req.params.vehicleId}`).get();
  if (!doc.exists || (req.authUser?.role === 'client' && doc.get('clientId') !== req.authUser.clientId)) throw Object.assign(new Error('Veículo não encontrado.'), { status: 404 });
  return { tid, doc };
}
const toLocation = (vehicleId: string, tagId: string, provider: 'traccar' | 'ktag', position: any) => ({ id: String(position.id ?? `${position.timestamp}-${position.lat}-${position.lon}`), vehicleId, tagId, provider, timestamp: Number(position.timestamp ?? Date.parse(position.fixTime || position.deviceTime || position.serverTime || '')), lat: Number(position.lat ?? position.latitude), lon: Number(position.lon ?? position.longitude), address: position.address ?? null, speed: position.speed, course: position.course, altitude: position.altitude, battery: position.battery ?? position.attributes?.batteryLevel });
const currentPositionRequests = new Map<string, Promise<any>>();
const coalescedPosition = (key: string, load: () => Promise<any>) => {
  const pending = currentPositionRequests.get(key); if (pending) return pending;
  const request = load().finally(() => currentPositionRequests.delete(key)); currentPositionRequests.set(key, request); return request;
};

vehiclesRouter.get('/:vehicleId/position', async (req, res) => {
  try {
    const { tid, doc } = await authorizedVehicle(req); const tagId = String(doc.get('tagId') || ''); if (!tagId) return res.status(409).json({ ok: false, error: 'Veículo sem tag vinculada.' });
    const tag = await adminDb.doc(`tenants/${tid}/tags/${tagId}`).get(); if (!tag.exists || tag.get('type') !== 'XADTAG') return res.status(422).json({ ok: false, error: 'A tag vinculada não é XADTAG.' });
    const deviceId = tag.get('traccarDeviceId'); if (!Number.isInteger(deviceId)) return res.status(409).json({ ok: false, error: 'XADTAG sem traccarDeviceId válido.' });
    try {
      const tracked = await coalescedPosition(`${tid}:${deviceId}`, async () => { const raw = await traccarClient.getLatestPositionForDevice(deviceId); if (!raw) throw new Error('POSITION_NOT_FOUND'); return xadTagService.resolvePosition(raw); });
      const point = toLocation(doc.id, tagId, 'traccar', tracked);
      await xadTagRepository.persistPosition({ id: tag.id, ...tag.data() } as any, tracked);
      await adminDb.runTransaction(async tx => { const current = await tx.get(doc.ref); if (point.timestamp > Number(current.get('lastPosition.timestamp') || 0)) tx.update(doc.ref, { lastPosition: point, lastPositionUpdatedAt: Date.now() }); });
      res.json({ ok: true, data: { ...point, degraded: false, errorCode: null } });
    } catch (error) {
      const fallback = doc.get('lastPosition'); if (fallback && fallback.tagId === tagId) return res.json({ ok: true, data: { ...fallback, degraded: true, provider: 'traccar', errorCode: 'TRACCAR_UNAVAILABLE' } });
      throw error;
    }
  } catch (error: any) { res.status(error.status || 502).json({ ok: false, error: error.message || 'Falha ao consultar posição.', errorCode: 'POSITION_UNAVAILABLE' }); }
});

vehiclesRouter.get('/:vehicleId/history', async (req, res) => {
  try {
    const { tid } = await authorizedVehicle(req);
    res.json({ ok: true, data: await trackingHistoryService.forVehicle(tid, req.params.vehicleId, req.query as Record<string, unknown>) });
  } catch (error: any) { res.status(error instanceof HistoryRequestError ? error.status : error.status || 502).json({ ok: false, error: error.message || 'Falha ao consultar histórico.' }); }
});
