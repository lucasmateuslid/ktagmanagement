import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { XadTagConflictError, xadTagRepository } from '../repositories/xadtagRepository.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { broadcastTenant } from '../services/positionBroadcast.js';
import { traccarRealtimeService } from '../services/traccarRealtimeService.js';
import { xadTagService } from '../services/xadtagService.js';
import { buildTraccarDeviceName, normalizeXadTagIdentity, originalXadTagIdentifier } from '../domain/xadtag.js';
import { HistoryRequestError, trackingHistoryService } from '../services/trackingHistoryService.js';

export const xadTagsRouter = Router();
xadTagsRouter.use(requireAuth);
const tenant = (req: Request) => { if (!req.tenantId || req.tenantId === 'admin' || req.tenantId === '__apex__') throw new Error('Empresa inválida.'); return req.tenantId; };
const fail = (res: Response, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha na integração Traccar.';
  return res.status(error instanceof XadTagConflictError ? 409 : /não encontrad|inválid|Informe|ultrapassar/i.test(message) ? 400 : 502).json({ ok: false, error: message });
};

const clientVehicleIds = async (req: Request) => {
  if (req.authUser?.role !== 'client' || !req.authUser.clientId) return null;
  const snap = await adminDb.collection(`tenants/${tenant(req)}/vehicles`).where('clientId', '==', req.authUser.clientId).get();
  return new Set(snap.docs.map(doc => doc.id));
};

const assertClientOwnsTag = async (req: Request, item: { linkedEntityId?: string | null }) => {
  const ids = await clientVehicleIds(req);
  if (ids && (!item.linkedEntityId || !ids.has(item.linkedEntityId))) throw new Error('XADTAG não encontrada.');
};

const editableOriginal = (value: { identifierOriginal?: string; traccarUniqueId?: string; identifierNormalized?: string; accessoryId?: string }) => {
  return originalXadTagIdentifier(String(value.identifierOriginal || value.traccarUniqueId || value.identifierNormalized || value.accessoryId || ''));
};

xadTagsRouter.use((req, res, next) => {
  const mutatesInventory = req.method !== 'GET' && !req.path.endsWith('/check');
  if (mutatesInventory && !['admin', 'moderator'].includes(req.authUser?.role || '')) {
    return res.status(403).json({ ok: false, error: 'Permissão insuficiente.' });
  }
  next();
});

// Autorização por objeto antes de alcançar os handlers. Clientes nunca listam
// estoque nem mutam vínculos; só consultam/check/history de tag ligada a veículo próprio.
xadTagsRouter.use(async (req, res, next) => {
  try {
    if (req.authUser?.role !== 'client') return next();
    if (req.path === '/' || req.path.startsWith('/import/') || req.path.endsWith('/link') || req.path.endsWith('/unlink')) {
      return res.status(403).json({ ok: false, error: 'Permissão insuficiente.' });
    }
    const id = req.path.split('/').filter(Boolean)[0];
    if (!id) return res.status(404).json({ ok: false, error: 'XADTAG não encontrada.' });
    const item = await xadTagRepository.get(tenant(req), id);
    if (!item) return res.status(404).json({ ok: false, error: 'XADTAG não encontrada.' });
    await assertClientOwnsTag(req, item);
    next();
  } catch {
    return res.status(404).json({ ok: false, error: 'XADTAG não encontrada.' });
  }
});

xadTagsRouter.post('/', async (req, res) => { try {
  const tid = tenant(req); const body = req.body || {};
  const identity = normalizeXadTagIdentity(String(body.identifierOriginal ?? body.imei ?? ''));
  const identifierOriginal = identity.original;
  const traccarUniqueId = identity.normalized;
  const result = await xadTagService.register({
    tenantId: tid, tenantSlug: tid, name: String(body.name || body.description || `XADTAG ${identifierOriginal}`),
    identifierKind: identity.kind, identifierOriginal, identifierProfile: identity.profile,
    traccarUniqueId, requestId: String(req.headers['x-request-id'] || crypto.randomUUID()),
    ...(body.traqcareId !== undefined ? { traqcareId: String(body.traqcareId) } : {}),
    ...(body.powerType === 'battery' || body.powerType === '12v' ? { powerType: body.powerType } : {}),
    ...(Number.isFinite(Number(body.batteryWarrantyYears)) ? { batteryWarrantyYears: Number(body.batteryWarrantyYears) } : {}),
  });
  await xadTagRepository.audit(tid, req.authUser!.uid, 'xadtag.created', result.item.id, result.item.integrationStatus);
  await traccarRealtimeService.refreshMapping();
  const device = Number.isInteger(result.item.traccarDeviceId) ? { id: result.item.traccarDeviceId, uniqueId: result.item.traccarUniqueId, positionId: result.item.traccarPositionId, name: result.item.traccarDeviceName } : null;
  res.status(result.item.integrationStatus === 'pending' ? 202 : result.created ? 201 : 200).json({ ok: true, data: { tag: result.item, created: result.created, localTagCreated: result.localTagCreated, reusedExistingDevice: result.reusedExistingDevice, identifierOriginal: result.item.identifierOriginal, identifierNormalized: result.item.identifierNormalized, device } });
} catch (error) { fail(res, error); } });
xadTagsRouter.put('/:id', async (req, res) => { try {
  const tid = tenant(req); const item = await xadTagRepository.get(tid, req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: 'XADTAG não encontrada.' });
  const identifierOriginal = editableOriginal({ ...item, identifierOriginal: req.body?.identifierOriginal });
  const updated = await xadTagService.reconcile(item, {
    name: String(req.body?.name ?? item.name), identifierOriginal,
    ...(req.body?.traqcareId !== undefined ? { traqcareId: String(req.body.traqcareId) } : {}),
    ...(req.body?.powerType === 'battery' || req.body?.powerType === '12v' ? { powerType: req.body.powerType } : {}),
    ...(Number.isFinite(Number(req.body?.batteryWarrantyYears)) ? { batteryWarrantyYears: Number(req.body.batteryWarrantyYears) } : {}),
  });
  await xadTagRepository.audit(tid, req.authUser!.uid, 'xadtag.reconciled', item.id, 'success');
  await traccarRealtimeService.refreshMapping();
  res.json({ ok: true, data: updated });
} catch (error) { fail(res, error); } });
xadTagsRouter.post('/:id/retry', async (req, res) => { try {
  const tid = tenant(req); const item = await xadTagRepository.get(tid, req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: 'XADTAG não encontrada.' });
  const updated = await xadTagService.reconcile(item, { name: item.name, identifierOriginal: editableOriginal(item) });
  await traccarRealtimeService.refreshMapping(); res.json({ ok: true, data: updated });
} catch (error) { fail(res, error); } });
xadTagsRouter.get('/', async (req, res) => { try { res.json({ ok: true, data: await xadTagRepository.list(tenant(req)) }); } catch (error) { fail(res, error); } });
xadTagsRouter.get('/:id', async (req, res) => { try { const item = await xadTagRepository.get(tenant(req), req.params.id); if (!item) return res.status(404).json({ ok: false, error: 'XADTAG não encontrada.' }); res.json({ ok: true, data: item }); } catch (error) { fail(res, error); } });
xadTagsRouter.post('/:id/check', async (req, res) => { try { const tid = tenant(req); const item = await xadTagRepository.get(tid, req.params.id); if (!item) return res.status(404).json({ ok: false, error: 'XADTAG não encontrada.' }); const result = await xadTagService.check(item); const fresh = await xadTagRepository.get(tid, item.id); const marker = fresh ? xadTagService.toLiveMap(fresh) : null; if (marker) broadcastTenant(tid, { type: 'position', data: marker }); await xadTagRepository.audit(tid, req.authUser!.uid, 'xadtag.checked', item.id, 'success'); res.json({ ok: true, data: result }); } catch (error) { fail(res, error); } });
xadTagsRouter.get('/:id/history', async (req, res) => { try { const tid = tenant(req); const item = await xadTagRepository.get(tid, req.params.id); if (!item) return res.status(404).json({ ok: false, error: 'XADTAG não encontrada.' }); const to = String(req.query.to || new Date().toISOString()); const from = String(req.query.from || new Date(Date.now() - 86_400_000).toISOString()); const data = await xadTagService.history(item, from, to); res.json({ ok: true, data }); } catch (error) { fail(res, error); } });
xadTagsRouter.post('/:id/link', (_req, res) => res.status(410).json({ ok: false, error: 'Use PUT /api/vehicles/:vehicleId/tag para vínculo transacional.' }));
xadTagsRouter.post('/:id/unlink', (_req, res) => res.status(410).json({ ok: false, error: 'Use DELETE /api/vehicles/:vehicleId/tag para desvínculo transacional.' }));

xadTagsRouter.post('/import/preview', async (req, res) => { try { const tid = tenant(req); const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 1000) : []; const data = await Promise.all(rows.map(async (row: Record<string, unknown>, index: number) => { try { const identity = normalizeXadTagIdentity(String(row.imei ?? row['Serial/IMEI'] ?? '')); const existing = await xadTagRepository.findByIdentifier(tid, identity.normalized); return { index, imeiOriginal: identity.original, identifierKind: identity.kind, identifierNormalized: identity.normalized, traccarDeviceName: buildTraccarDeviceName(tid, identity.original), status: existing ? 'existing' : 'ready' }; } catch (error) { return { index, imeiOriginal: String(row.imei || ''), status: 'invalid', error: (error as Error).message }; } })); res.json({ ok: true, data }); } catch (error) { fail(res, error); } });
xadTagsRouter.post('/import/commit', async (req, res) => { try { const tid = tenant(req); const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 1000) : []; const results: Array<Record<string, unknown>> = []; let cursor = 0; const workers = Array.from({ length: Math.min(5, rows.length) }, async () => { while (cursor < rows.length) { const index = cursor++; const row = rows[index]; try { const identity = normalizeXadTagIdentity(String(row.identifierOriginal ?? row.imei ?? row['Serial/IMEI'] ?? '')); const result = await xadTagService.register({ tenantId: tid, tenantSlug: tid, name: String(row.name || row.description || `XADTAG ${identity.original}`), identifierKind: identity.kind, identifierOriginal: identity.original, identifierProfile: identity.profile, traccarUniqueId: identity.normalized }); results[index] = { index, status: result.item.integrationStatus === 'pending' ? 'pending' : result.created ? 'created' : 'existing', id: result.item.id }; } catch (error) { results[index] = { index, status: error instanceof XadTagConflictError ? 'unavailable' : 'invalid', error: (error as Error).message }; } } }); await Promise.all(workers); const summary = { total: rows.length, created: results.filter(r => r.status === 'created').length, existing: results.filter(r => r.status === 'existing').length, pending: results.filter(r => r.status === 'pending').length, invalid: results.filter(r => r.status === 'invalid').length, unavailable: results.filter(r => r.status === 'unavailable').length }; await xadTagRepository.audit(tid, req.authUser!.uid, 'xadtag.imported', null, JSON.stringify(summary)); await traccarRealtimeService.refreshMapping(); console.info(JSON.stringify({ event: 'traccar.import.completed', tenantId: tid, ...summary })); res.json({ ok: true, data: { ...summary, rows: results } }); } catch (error) { fail(res, error); } });

export const liveMapRouter = Router();
liveMapRouter.use(requireAuth);
liveMapRouter.get('/', async (req, res) => { try { const ids = await clientVehicleIds(req); const items = await xadTagRepository.list(tenant(req)); const authorized = ids ? items.filter(item => item.linkedEntityId && ids.has(item.linkedEntityId)) : items; const data = authorized.map(item => xadTagService.toLiveMap(item)).filter(Boolean); res.json({ ok: true, data }); } catch (error) { fail(res, error); } });
liveMapRouter.get('/tags/:id/history', async (req, res) => {
  try {
    if (req.authUser?.role === 'client') return res.status(403).json({ ok: false, error: 'Permissão insuficiente.' });
    res.json({ ok: true, data: await trackingHistoryService.forTag(tenant(req), req.params.id, req.query as Record<string, unknown>) });
  } catch (error: any) {
    res.status(error instanceof HistoryRequestError ? error.status : 502).json({ ok: false, error: error.message || 'Falha ao consultar histórico.' });
  }
});
