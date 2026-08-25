import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { createHmac } from 'node:crypto';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { traccarClient } from '../services/traccarClient.js';
import { xadTagService } from '../services/xadtagService.js';
import { xadTagRepository } from '../repositories/xadtagRepository.js';
import { HistoryRequestError, trackingHistoryService } from '../services/trackingHistoryService.js';
import {
  buildVehicleSearchNgrams, decryptTenantValue, encryptTenantValue,
  normalizeVehicleSearch, vehicleSearchCandidateToken,
} from '../services/vehicleSearch.js';

export const vehiclesRouter = Router();
vehiclesRouter.use(requireAuth);

const tenantId = (req: any) => {
  const value = String(req.tenantId || '');
  if (!value || value === 'admin' || value === '__apex__') throw Object.assign(new Error('Empresa inválida.'), { status: 400 });
  return value;
};
const normalizeSearch = normalizeVehicleSearch;
const defined = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const vehicleDto = (tenant: string, doc: FirebaseFirestore.DocumentSnapshot) => {
  const value = doc.data() || {};
  return { id: doc.id, ...value, plate: decryptTenantValue(tenant, value.plate), chassis: value.chassis ? decryptTenantValue(tenant, value.chassis) : undefined };
};
const vehicleDtos = async (tenant: string, docs: FirebaseFirestore.DocumentSnapshot[]) => {
  const userIds = [...new Set(docs.map(doc => String(doc.get('updatedBy') || doc.get('createdBy') || '')).filter(Boolean))];
  const userDocs = userIds.length
    ? await adminDb.getAll(...userIds.map(id => adminDb.doc(`tenants/${tenant}/users/${id}`)))
    : [];
  const userNames = new Map(userDocs.filter(doc => doc.exists).map(doc => [doc.id, decryptTenantValue(tenant, doc.get('name'))]));
  return docs.map(doc => {
    const dto = vehicleDto(tenant, doc);
    const userId = String(doc.get('updatedBy') || doc.get('createdBy') || '');
    return { ...dto, updatedByName: userNames.get(userId) || doc.get('createdByName') || undefined };
  });
};
const encodeCursor = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const decodeCursor = (value: unknown): any => { try { return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8')); } catch { throw Object.assign(new Error('Cursor inválido.'), { status: 400 }); } };
const filtersHash = (query: any) => createHmac('sha256', process.env.SEARCH_INDEX_KEY || 'ktag-search-index-v1').update(JSON.stringify(query)).digest('hex').slice(0, 16);
const matchesFilters = (data: any, filters: Record<string, string>) => (!filters.status || data.status === filters.status)
  && (!filters.companyId || data.companyId === filters.companyId)
  && (!filters.ownershipStatus || data.ownershipStatus === filters.ownershipStatus)
  && (!filters.installationType || data.installationType === filters.installationType)
  && (!filters.tag || (filters.tag === 'linked' ? Boolean(data.tagId) : !data.tagId));
const SEARCH_CACHE_TTL_MS = 30_000;
const SEARCH_CACHE_MAX_ENTRIES = 250;
const searchCache = new Map<string, { expiresAt: number; payload: unknown }>();
const cachedSearch = (key: string) => {
  const entry = searchCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) { searchCache.delete(key); return null; }
  return entry.payload;
};
const cacheSearch = (key: string, payload: unknown) => {
  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) searchCache.delete(searchCache.keys().next().value as string);
  searchCache.set(key, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, payload });
};
const invalidateVehicleCache = (tenant: string) => {
  for (const key of searchCache.keys()) if (key.startsWith(`${tenant}:`)) searchCache.delete(key);
};
const indexUnavailable = (error: any) => Number(error?.code) === 9
  || String(error?.code || '').includes('failed-precondition')
  || /index.*(?:building|requires an index)/i.test(String(error?.message || ''));

async function fallbackVehicleSearch(tenant: string, clientId: string | null, search: string, filters: Record<string, string>, limit: number) {
  let snapshot: FirebaseFirestore.QuerySnapshot;
  try {
    let query: FirebaseFirestore.Query = adminDb.collection(`tenants/${tenant}/vehicles`).orderBy('createdAt', 'desc');
    if (clientId) query = query.where('clientId', '==', clientId);
    snapshot = await query.limit(500).get();
  } catch {
    snapshot = await adminDb.collection(`tenants/${tenant}/vehicles`).limit(500).get();
  }
  const candidates = snapshot.docs.filter(doc => (!clientId || doc.get('clientId') === clientId) && matchesFilters(doc.data(), filters));
  const clientIds = [...new Set(candidates.map(doc => String(doc.get('clientId') || '')).filter(Boolean))];
  const clientDocs = clientIds.length ? await adminDb.getAll(...clientIds.map(id => adminDb.doc(`tenants/${tenant}/clients/${id}`))) : [];
  const clientNames = new Map(clientDocs.filter(doc => doc.exists).map(doc => [doc.id, decryptTenantValue(tenant, doc.get('name'))]));
  return candidates.filter(doc => normalizeSearch([
    decryptTenantValue(tenant, doc.get('plate')), doc.get('model'), clientNames.get(String(doc.get('clientId') || '')) || '',
  ].join(' ')).includes(search)).sort((a, b) => Number(b.get('createdAt') || 0) - Number(a.get('createdAt') || 0)).slice(0, limit);
}

vehiclesRouter.get('/', requirePermission('ROUTE_VEHICLES', ['admin', 'moderator', 'user', 'client']), async (req, res) => {
  try {
    const tid = tenantId(req); const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filters = { status: String(req.query.status || ''), companyId: String(req.query.companyId || ''), ownershipStatus: String(req.query.ownershipStatus || ''), installationType: String(req.query.installationType || ''), tag: String(req.query.tag || '') };
    const search = normalizeSearch(req.query.search); const clientId = req.authUser?.role === 'client' ? req.authUser.clientId : null;
    const signature = filtersHash({ filters, search, clientId }); const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (cursor && (cursor.signature !== signature || !Number.isFinite(cursor.createdAt) || typeof cursor.id !== 'string')) throw Object.assign(new Error('Cursor não corresponde aos filtros atuais.'), { status: 400 });
    if (search) {
      const cacheKey = `${tid}:${req.authUser?.uid || 'anonymous'}:${signature}:${String(req.query.cursor || 'first')}:${limit}`;
      const hit = cachedSearch(cacheKey);
      if (hit) return res.json(hit);
      const startedAt = Date.now(); const candidateToken = vehicleSearchCandidateToken(tid, search)!;
      let indexed: FirebaseFirestore.Query = adminDb.collection(`tenants/${tid}/vehicles`).where('searchNgrams', 'array-contains', candidateToken);
      if (clientId) indexed = indexed.where('clientId', '==', clientId);
      indexed = indexed.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
      if (cursor) indexed = indexed.startAfter(cursor.createdAt, cursor.id);
      const matched: FirebaseFirestore.QueryDocumentSnapshot[] = []; let exhausted = false; let scanCursor: { createdAt: number; id: string } | null = null; let scanned = 0;
      while (matched.length < limit + 1 && !exhausted) {
        let batchQuery = indexed;
        if (scanCursor) batchQuery = batchQuery.startAfter(scanCursor.createdAt, scanCursor.id);
        let snapshot: FirebaseFirestore.QuerySnapshot;
        try { snapshot = await batchQuery.limit(Math.max(50, limit * 2)).get(); }
        catch (error) {
          if (!indexUnavailable(error) || cursor) throw error;
          const fallback = await fallbackVehicleSearch(tid, clientId, search, filters, limit);
          const data = { items: await vehicleDtos(tid, fallback), nextCursor: null, previousCursor: null, hasNextPage: false, hasPreviousPage: false, pageSize: limit, fallback: true };
          const payload = { ok: true, data };
          cacheSearch(cacheKey, payload);
          console.warn(JSON.stringify({ event: 'vehicles.search.index_unavailable', tenantId: tid, returned: fallback.length, durationMs: Date.now() - startedAt }));
          return res.json(payload);
        }
        scanned += snapshot.size;
        if (snapshot.empty) { exhausted = true; break; }
        const clientIds = [...new Set(snapshot.docs.map(doc => String(doc.get('clientId') || '')).filter(Boolean))];
        const clientDocs = clientIds.length ? await adminDb.getAll(...clientIds.map(id => adminDb.doc(`tenants/${tid}/clients/${id}`))) : [];
        const clientNames = new Map(clientDocs.filter(doc => doc.exists).map(doc => [doc.id, decryptTenantValue(tid, doc.get('name'))]));
        for (const doc of snapshot.docs) {
          const data = doc.data(); if (!matchesFilters(data, filters)) continue;
          const haystack = normalizeSearch([decryptTenantValue(tid, data.plate), data.model, clientNames.get(String(data.clientId || '')) || ''].join(' '));
          if (haystack.includes(search)) matched.push(doc);
          if (matched.length >= limit + 1) break;
        }
        const boundary = snapshot.docs.at(-1);
        scanCursor = boundary ? { createdAt: Number(boundary.get('createdAt') || 0), id: boundary.id } : scanCursor;
        exhausted = snapshot.size < Math.max(50, limit * 2);
      }
      // O índice composto pode estar ativo antes do backfill dos documentos
      // antigos. Nesse intervalo, uma consulta válida retorna zero candidatos.
      // Confirma em uma varredura limitada para não apagar resultados que o
      // navegador já encontrou na página carregada.
      if (matched.length === 0 && !cursor) {
        const fallback = await fallbackVehicleSearch(tid, clientId, search, filters, limit);
        if (fallback.length > 0) {
          const data = { items: await vehicleDtos(tid, fallback), nextCursor: null, previousCursor: null, hasNextPage: false, hasPreviousPage: false, pageSize: limit, fallback: true };
          const payload = { ok: true, data };
          cacheSearch(cacheKey, payload);
          console.warn(JSON.stringify({ event: 'vehicles.search.backfill_pending', tenantId: tid, returned: fallback.length, durationMs: Date.now() - startedAt }));
          return res.json(payload);
        }
      }
      const items = matched.slice(0, limit); const last = items.at(-1); const hasNextPage = matched.length > limit || !exhausted;
      console.info(JSON.stringify({ event: 'vehicles.search.completed', tenantId: tid, scanned, returned: items.length, durationMs: Date.now() - startedAt }));
      const payload = { ok: true, data: { items: await vehicleDtos(tid, items), nextCursor: hasNextPage && last ? encodeCursor({ createdAt: Number(last.get('createdAt') || 0), id: last.id, signature }) : null, previousCursor: null, hasNextPage, hasPreviousPage: false, pageSize: limit } };
      cacheSearch(cacheKey, payload);
      return res.json(payload);
    }
    let query: FirebaseFirestore.Query = adminDb.collection(`tenants/${tid}/vehicles`);
    if (clientId) query = query.where('clientId', '==', clientId);
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
    res.json({ ok: true, data: { items: await vehicleDtos(tid, itemsDocs), nextCursor: hasNextPage && last ? makeCursor(last) : null, previousCursor: hasPreviousPage && first ? makeCursor(first) : null, hasNextPage, hasPreviousPage, pageSize: limit } });
  } catch (error: any) {
    console.error(JSON.stringify({ event: 'vehicles.list.failed', code: error?.code, message: error?.message }));
    const status = error.status && error.status < 500 ? error.status : indexUnavailable(error) ? 503 : 500;
    const message = status === 503 ? 'A pesquisa está sendo preparada. Tente novamente em alguns instantes.' : status >= 500 ? 'Não foi possível consultar os veículos agora.' : error.message;
    res.status(status).json({ ok: false, error: message, errorCode: indexUnavailable(error) ? 'SEARCH_INDEX_BUILDING' : 'VEHICLE_LIST_FAILED' });
  }
});

vehiclesRouter.post('/reindex-client/:clientId', requirePermission('ACTION_VEHICLES_MANAGE', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenantId(req); const clientId = String(req.params.clientId || '');
    const [client, vehicles] = await Promise.all([
      adminDb.doc(`tenants/${tid}/clients/${clientId}`).get(),
      adminDb.collection(`tenants/${tid}/vehicles`).where('clientId', '==', clientId).get(),
    ]);
    if (!client.exists) return res.status(404).json({ ok: false, error: 'Cliente não encontrado.' });
    const clientName = decryptTenantValue(tid, client.get('name')); let updated = 0;
    for (let offset = 0; offset < vehicles.size; offset += 450) {
      const batch = adminDb.batch();
      for (const vehicle of vehicles.docs.slice(offset, offset + 450)) {
        batch.update(vehicle.ref, { searchNgrams: buildVehicleSearchNgrams(tid, [decryptTenantValue(tid, vehicle.get('plate')), vehicle.get('model'), clientName]) });
        updated += 1;
      }
      await batch.commit();
    }
    res.json({ ok: true, data: { clientId, updated } });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao reindexar veículos do cliente.' }); }
});

vehiclesRouter.post('/', requirePermission('ACTION_VEHICLES_MANAGE', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenantId(req); const body = req.body || {}; const id = String(body.id || crypto.randomUUID());
    const plate = String(body.plate || '').trim().toUpperCase(); const model = String(body.model || '').trim(); const clientId = String(body.clientId || '');
    if (!plate || !model || !clientId) return res.status(400).json({ ok: false, error: 'Placa, modelo e cliente são obrigatórios.' });
    const ref = adminDb.doc(`tenants/${tid}/vehicles/${id}`); if ((await ref.get()).exists) return res.status(409).json({ ok: false, error: 'Veículo já cadastrado.' });
    const client = await adminDb.doc(`tenants/${tid}/clients/${clientId}`).get();
    const searchNgrams = buildVehicleSearchNgrams(tid, [plate, model, client.exists ? decryptTenantValue(tid, client.get('name')) : '']);
    const data = defined({ ...body, id: undefined, tagId: undefined, plate: encryptTenantValue(tid, plate), chassis: body.chassis ? encryptTenantValue(tid, body.chassis) : undefined, searchNgrams, createdAt: Number(body.createdAt) || Date.now(), updatedAt: Date.now(), updatedBy: req.authUser!.uid });
    await ref.create(data); await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId: req.authUser!.uid, action: 'CREATE', entity: 'Vehicle', entityId: id, timestamp: FieldValue.serverTimestamp() });
    invalidateVehicleCache(tid);
    res.status(201).json({ ok: true, data: vehicleDto(tid, await ref.get()) });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao criar veículo.' }); }
});

vehiclesRouter.put('/:vehicleId', requirePermission('ACTION_VEHICLES_MANAGE', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenantId(req); const ref = adminDb.doc(`tenants/${tid}/vehicles/${req.params.vehicleId}`); const current = await ref.get();
    if (!current.exists) return res.status(404).json({ ok: false, error: 'Veículo não encontrado.' });
    const body = req.body || {}; const plate = String(body.plate || decryptTenantValue(tid, current.get('plate'))).trim().toUpperCase(); const model = String(body.model || current.get('model') || '').trim(); const clientId = String(body.clientId || current.get('clientId') || '');
    const client = await adminDb.doc(`tenants/${tid}/clients/${clientId}`).get();
    const searchNgrams = buildVehicleSearchNgrams(tid, [plate, model, client.exists ? decryptTenantValue(tid, client.get('name')) : '']);
    const protectedFields = new Set(['id', 'tagId', 'activeTrackingAssignmentId', 'lastPosition', 'createdAt']); const changes = Object.fromEntries(Object.entries(body).filter(([key, value]) => !protectedFields.has(key) && value !== undefined));
    await ref.update(defined({ ...changes, plate: encryptTenantValue(tid, plate), chassis: body.chassis ? encryptTenantValue(tid, body.chassis) : body.chassis === '' ? FieldValue.delete() : undefined, searchNgrams, updatedAt: Date.now(), updatedBy: req.authUser!.uid }));
    invalidateVehicleCache(tid);
    await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId: req.authUser!.uid, action: 'UPDATE', entity: 'Vehicle', entityId: ref.id, timestamp: FieldValue.serverTimestamp() });
    res.json({ ok: true, data: vehicleDto(tid, await ref.get()) });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao atualizar veículo.' }); }
});

vehiclesRouter.delete('/:vehicleId', requirePermission('ACTION_VEHICLES_MANAGE', ['admin', 'moderator']), async (req, res) => {
  try {
    const tid = tenantId(req); const vehicleRef = adminDb.doc(`tenants/${tid}/vehicles/${req.params.vehicleId}`); const now = Date.now();
    await adminDb.runTransaction(async tx => {
      const vehicle = await tx.get(vehicleRef); if (!vehicle.exists) throw Object.assign(new Error('Veículo não encontrado.'), { status: 404 });
      const tagId = String(vehicle.get('tagId') || ''); const tagRef = tagId ? adminDb.doc(`tenants/${tid}/tags/${tagId}`) : null; const tag = tagRef ? await tx.get(tagRef) : null;
      const assignmentId = String(vehicle.get('activeTrackingAssignmentId') || tag?.get('activeTrackingAssignmentId') || ''); const assignmentRef = assignmentId ? adminDb.doc(`tenants/${tid}/tracking_assignments/${assignmentId}`) : null; const assignment = assignmentRef ? await tx.get(assignmentRef) : null;
      if (assignment?.exists && assignment.get('endedAt') === null) tx.update(assignment.ref, { endedAt: now, endedBy: req.authUser!.uid, endReason: 'vehicle_deleted' });
      if (tag?.exists) tx.update(tag.ref, { status: 'disponível', linkedEntityType: null, linkedEntityId: null, linkedEntityName: null, linkedAt: null, linkedBy: null, activeTrackingAssignmentId: null, updatedAt: now });
      tx.delete(vehicleRef); tx.set(adminDb.collection(`tenants/${tid}/audit_logs`).doc(), { userId: req.authUser!.uid, action: 'DELETE', entity: 'Vehicle', entityId: req.params.vehicleId, tagId: tagId || null, timestamp: FieldValue.serverTimestamp() });
    });
    invalidateVehicleCache(tid);
    res.json({ ok: true, data: { id: req.params.vehicleId } });
  } catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao excluir veículo.' }); }
});

vehiclesRouter.put('/:vehicleId/tag', requirePermission('ACTION_VEHICLES_MANAGE', ['admin', 'moderator']), async (req, res) => {
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

vehiclesRouter.delete('/:vehicleId/tag', requirePermission('ACTION_VEHICLES_MANAGE', ['admin', 'moderator']), async (req, res) => {
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
const historyRequestId = (value: unknown) => { const candidate = String(value || ''); return /^[A-Za-z0-9._-]{1,100}$/.test(candidate) ? candidate : crypto.randomUUID(); };

const historyLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.HISTORY_RATE_LIMIT_PER_MINUTE) || 20,
  standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: req => `${req.authUser?.uid || 'anonymous'}:${req.params.vehicleId || 'unknown'}`,
  handler: (req, res) => {
    const requestId = historyRequestId(req.headers['x-request-id']);
    res.status(429).json({ ok: false, requestId, errorCode: 'RATE_LIMITED', error: 'Muitas consultas de histórico. Tente novamente em instantes.' });
  },
});

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

vehiclesRouter.get('/:vehicleId/history', historyLimiter, async (req, res) => {
  const requestId = historyRequestId(req.headers['x-request-id']); const startedAt = Date.now();
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Request-Id', requestId);
  try {
    const { tid } = await authorizedVehicle(req);
    const vehicleId = String(req.params.vehicleId);
    const data = await trackingHistoryService.forVehicle(tid, vehicleId, req.query as Record<string, unknown>, requestId);
    console.info(JSON.stringify({ event: 'tracking.history.completed', requestId, userId: req.authUser?.uid, vehicleId: req.params.vehicleId, from: data.from, to: data.to, providers: [...new Set(data.points.map(point => point.provider))], returned: data.points.length, truncated: data.truncated, partial: data.partial, durationMs: Date.now() - startedAt }));
    res.json({ ok: true, data });
  } catch (error: any) {
    const mapped = error instanceof HistoryRequestError ? error : new HistoryRequestError('Falha ao consultar histórico.', error.status || 502, 'PROVIDER_UNAVAILABLE');
    console.error(JSON.stringify({ event: 'tracking.history.failed', requestId, userId: req.authUser?.uid, vehicleId: req.params.vehicleId, errorCode: mapped.code, durationMs: Date.now() - startedAt }));
    res.status(mapped.status).json({ ok: false, requestId, errorCode: mapped.code, error: mapped.message });
  }
});
