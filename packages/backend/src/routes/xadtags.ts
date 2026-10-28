import { Router, type Request, type Response } from 'express';
import { requireAuth, requireInternalUser, requirePermission } from '../middleware/auth.js';
import { XadTagConflictError, xadTagRepository } from '../repositories/xadtagRepository.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { broadcastTenant } from '../services/positionBroadcast.js';
import { traccarRealtimeService } from '../services/traccarRealtimeService.js';
import { traccarClient } from '../services/traccarClient.js';
import { xadTagService } from '../services/xadtagService.js';
import { originalXadTagIdentifier } from '../domain/xadtag.js';
import { buildTraccarTagDeviceName, traccarTagProfile } from '../domain/traccarTagModel.js';
import { HistoryRequestError, trackingHistoryService } from '../services/trackingHistoryService.js';
import { latestTenantFleetRefresh, refreshTenantFleet } from '../services/fleetRefreshService.js';
import { refreshSingleTagResult } from '../services/singleTagRefreshService.js';
import { afterVehicleLink } from '../services/currentPosition.js';

export const xadTagsRouter = Router();
xadTagsRouter.use(requireAuth);
const tenant = (req: Request) => { if (!req.tenantId || req.tenantId === 'admin' || req.tenantId === '__apex__') throw new Error('Empresa inválida.'); return req.tenantId; };
const fail = (res: Response, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha na integração Traccar.';
  return res.status(error instanceof XadTagConflictError ? 409 : /não encontrad|inválid|Informe|ultrapassar/i.test(message) ? 400 : 502).json({ ok: false, error: message });
};

const LIVE_MAP_CACHE_TTL_MS = 15_000;
const CLIENT_VEHICLE_CACHE_TTL_MS = 30_000;
const liveMapCache = new Map<string, { expiresAt: number; data: any[]; loading?: Promise<any[]> }>();
const clientVehicleCache = new Map<string, { expiresAt: number; ids: Set<string>; loading?: Promise<Set<string>> }>();

const clientVehicleIds = async (req: Request) => {
  if (req.authUser?.role !== 'client' || !req.authUser.clientId) return null;
  const cacheKey = `${tenant(req)}:${req.authUser.clientId}`;
  const cached = clientVehicleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;
  if (cached?.loading) return cached.loading;
  const loading = adminDb.collection(`tenants/${tenant(req)}/vehicles`).where('clientId', '==', req.authUser.clientId).get()
    .then(snap => {
      const ids = new Set(snap.docs.map(doc => doc.id));
      clientVehicleCache.set(cacheKey, { expiresAt: Date.now() + CLIENT_VEHICLE_CACHE_TTL_MS, ids });
      return ids;
    })
    .finally(() => {
      const current = clientVehicleCache.get(cacheKey);
      if (current?.loading === loading) clientVehicleCache.delete(cacheKey);
    });
  clientVehicleCache.set(cacheKey, { expiresAt: 0, ids: new Set(), loading });
  return loading;
};

const assertClientOwnsTag = async (req: Request, item: { linkedEntityId?: string | null }) => {
  const ids = await clientVehicleIds(req);
  if (ids && (!item.linkedEntityId || !ids.has(item.linkedEntityId))) throw new Error('Equipamento não encontrado.');
};

const editableOriginal = (value: { equipmentType?: string; identifierOriginal?: string; traccarUniqueId?: string; identifierNormalized?: string; accessoryId?: string }) => {
  const raw = String(value.identifierOriginal || value.traccarUniqueId || value.identifierNormalized || value.accessoryId || '');
  return value.equipmentType === 'H_TAG' ? raw : originalXadTagIdentifier(raw);
};

xadTagsRouter.use((req, res, next) => {
  const mutatesInventory = req.method !== 'GET' && !req.path.endsWith('/check');
  if (mutatesInventory) return requirePermission('ACTION_TAGS_MANAGE', ['admin', 'moderator'])(req, res, next);
  if (req.method === 'GET' && req.path === '/') return requirePermission('ROUTE_TAGS', ['admin', 'moderator'])(req, res, next);
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
    if (!id) return res.status(404).json({ ok: false, error: 'Equipamento não encontrado.' });
    const item = await xadTagRepository.get(tenant(req), id);
    if (!item) return res.status(404).json({ ok: false, error: 'Equipamento não encontrado.' });
    await assertClientOwnsTag(req, item);
    next();
  } catch {
    return res.status(404).json({ ok: false, error: 'Equipamento não encontrado.' });
  }
});

xadTagsRouter.post('/', async (req, res) => { try {
  const tid = tenant(req); const body = req.body || {};
  const profile = traccarTagProfile(body.model);
  const identity = profile.normalizeIdentity(String(body.identifierOriginal ?? body.imei ?? ''));
  const identifierOriginal = identity.original;
  const traccarUniqueId = identity.normalized;
  const result = await xadTagService.register({
    model: profile.model, tenantId: tid, tenantSlug: tid, name: String(body.name || body.description || `${profile.label} ${identifierOriginal}`),
    identifierKind: identity.kind, identifierOriginal, identifierProfile: identity.profile,
    traccarUniqueId, requestId: String(req.headers['x-request-id'] || crypto.randomUUID()),
    ...(body.traqcareId !== undefined ? { traqcareId: String(body.traqcareId) } : {}),
    ...(body.powerType === 'battery' || body.powerType === '12v' ? { powerType: body.powerType } : {}),
    ...(Number.isFinite(Number(body.batteryWarrantyYears)) ? { batteryWarrantyYears: Number(body.batteryWarrantyYears) } : {}),
    ...(Number.isFinite(Number(body.batteryStartedAt)) ? { batteryStartedAt: Number(body.batteryStartedAt) } : {}),
  });
  await xadTagRepository.audit(tid, req.authUser!.uid, 'xadtag.created', result.item.id, result.item.integrationStatus);
  await traccarRealtimeService.refreshMapping();
  const device = Number.isInteger(result.item.traccarDeviceId) ? { id: result.item.traccarDeviceId, uniqueId: result.item.traccarUniqueId, positionId: result.item.traccarPositionId, name: result.item.traccarDeviceName } : null;
  res.status(result.item.integrationStatus === 'pending' ? 202 : result.created ? 201 : 200).json({ ok: true, data: { tag: result.item, created: result.created, localTagCreated: result.localTagCreated, reusedExistingDevice: result.reusedExistingDevice, identifierOriginal: result.item.identifierOriginal, identifierNormalized: result.item.identifierNormalized, device } });
} catch (error) { fail(res, error); } });
xadTagsRouter.put('/:id', async (req, res) => { try {
  const tid = tenant(req); const item = await xadTagRepository.get(tid, req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: 'Equipamento não encontrado.' });
  const identifierOriginal = editableOriginal({ ...item, identifierOriginal: req.body?.identifierOriginal });
  const updated = await xadTagService.reconcile(item, {
    name: String(req.body?.name ?? item.name), identifierOriginal,
    ...(req.body?.traqcareId !== undefined ? { traqcareId: String(req.body.traqcareId) } : {}),
    ...(req.body?.powerType === 'battery' || req.body?.powerType === '12v' ? { powerType: req.body.powerType } : {}),
    ...(Number.isFinite(Number(req.body?.batteryWarrantyYears)) ? { batteryWarrantyYears: Number(req.body.batteryWarrantyYears) } : {}),
    ...(Number.isFinite(Number(req.body?.batteryStartedAt)) ? { batteryStartedAt: Number(req.body.batteryStartedAt) } : {}),
  });
  await xadTagRepository.audit(tid, req.authUser!.uid, 'xadtag.reconciled', item.id, 'success');
  await traccarRealtimeService.refreshMapping();
  res.json({ ok: true, data: updated });
} catch (error) { fail(res, error); } });
xadTagsRouter.post('/:id/retry', async (req, res) => { try {
  const tid = tenant(req); const item = await xadTagRepository.get(tid, req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: 'Equipamento não encontrado.' });
  const updated = await xadTagService.reconcile(item, { name: item.name, identifierOriginal: editableOriginal(item) });
  await traccarRealtimeService.refreshMapping(); res.json({ ok: true, data: updated });
} catch (error) { fail(res, error); } });
xadTagsRouter.get('/', async (req, res) => { try { res.json({ ok: true, data: await xadTagRepository.list(tenant(req)) }); } catch (error) { fail(res, error); } });
xadTagsRouter.get('/:id', async (req, res) => { try { const item = await xadTagRepository.get(tenant(req), req.params.id); if (!item) return res.status(404).json({ ok: false, error: 'Equipamento não encontrado.' }); res.json({ ok: true, data: item }); } catch (error) { fail(res, error); } });
xadTagsRouter.post('/:id/check', async (req, res) => { try { const tid = tenant(req); const item = await xadTagRepository.get(tid, req.params.id); if (!item) return res.status(404).json({ ok: false, error: 'Equipamento não encontrado.' }); const result = await xadTagService.check(item); const fresh = await xadTagRepository.get(tid, item.id); const marker = fresh ? xadTagService.toLiveMap(fresh) : null; if (marker) broadcastTenant(tid, { type: 'position', data: marker }); await xadTagRepository.audit(tid, req.authUser!.uid, 'xadtag.checked', item.id, 'success'); res.json({ ok: true, data: result }); } catch (error) { fail(res, error); } });
xadTagsRouter.get('/:id/history', async (req, res) => { try { const tid = tenant(req); const item = await xadTagRepository.get(tid, req.params.id); if (!item) return res.status(404).json({ ok: false, error: 'Equipamento não encontrado.' }); const to = String(req.query.to || new Date().toISOString()); const from = String(req.query.from || new Date(Date.now() - 86_400_000).toISOString()); const data = await xadTagService.history(item, from, to); res.json({ ok: true, data }); } catch (error) { fail(res, error); } });
xadTagsRouter.post('/:id/link', (_req, res) => res.status(410).json({ ok: false, error: 'Use PUT /api/vehicles/:vehicleId/tag para vínculo transacional.' }));
xadTagsRouter.post('/:id/unlink', (_req, res) => res.status(410).json({ ok: false, error: 'Use DELETE /api/vehicles/:vehicleId/tag para desvínculo transacional.' }));

xadTagsRouter.post('/import/preview', async (req, res) => { try { const tid = tenant(req); const profile = traccarTagProfile(req.body?.model); const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 1000) : []; const data = await Promise.all(rows.map(async (row: Record<string, unknown>, index: number) => { try { const identity = profile.normalizeIdentity(String(row.imei ?? row['Serial/IMEI'] ?? '')); const existing = await xadTagRepository.findByIdentifier(tid, identity.normalized); return { index, imeiOriginal: identity.original, identifierKind: identity.kind, identifierNormalized: identity.normalized, traccarDeviceName: buildTraccarTagDeviceName(profile.model, tid, identity.original), status: existing ? 'existing' : 'ready' }; } catch (error) { return { index, imeiOriginal: String(row.imei || ''), status: 'invalid', error: (error as Error).message }; } })); res.json({ ok: true, data }); } catch (error) { fail(res, error); } });
xadTagsRouter.post('/import/commit', async (req, res) => { try { const tid = tenant(req); const profile = traccarTagProfile(req.body?.model); const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 1000) : []; const results: Array<Record<string, unknown>> = []; let cursor = 0; const workers = Array.from({ length: Math.min(5, rows.length) }, async () => { while (cursor < rows.length) { const index = cursor++; const row = rows[index]; try { const identity = profile.normalizeIdentity(String(row.identifierOriginal ?? row.imei ?? row['Serial/IMEI'] ?? '')); const result = await xadTagService.register({ model: profile.model, tenantId: tid, tenantSlug: tid, name: String(row.name || row.nome || row.description || `${profile.label} ${identity.original}`), identifierKind: identity.kind, identifierOriginal: identity.original, identifierProfile: identity.profile, traccarUniqueId: identity.normalized }); results[index] = { index, status: result.item.integrationStatus === 'pending' ? 'pending' : result.created ? 'created' : 'existing', id: result.item.id }; } catch (error) { results[index] = { index, status: error instanceof XadTagConflictError ? 'unavailable' : 'invalid', error: (error as Error).message }; } } }); await Promise.all(workers); const summary = { total: rows.length, created: results.filter(r => r.status === 'created').length, existing: results.filter(r => r.status === 'existing').length, pending: results.filter(r => r.status === 'pending').length, invalid: results.filter(r => r.status === 'invalid').length, unavailable: results.filter(r => r.status === 'unavailable').length }; await xadTagRepository.audit(tid, req.authUser!.uid, 'xadtag.imported', null, JSON.stringify({ model: profile.model, ...summary })).catch(error => console.warn(JSON.stringify({ event: 'traccar.import.audit_failed', error: (error as Error).message }))); await traccarRealtimeService.refreshMapping().catch(error => console.warn(JSON.stringify({ event: 'traccar.mapping.refresh_failed', error: (error as Error).message }))); console.info(JSON.stringify({ event: 'traccar.import.completed', tenantId: tid, model: profile.model, ...summary })); res.json({ ok: true, data: { ...summary, rows: results } }); } catch (error) { fail(res, error); } });

export const liveMapRouter = Router();
liveMapRouter.use(requireAuth);
liveMapRouter.post('/refresh', requireInternalUser, async (req, res) => {
  try {
    const tid = tenant(req); const current = await latestTenantFleetRefresh(tid);
    if (current.busy) return res.status(202).json({ ok: true, data: current });
    const queued = { ...current, id: crypto.randomUUID(), trigger: 'manual' as const,
      startedAt: Date.now(), completedAt: 0, busy: true, error: null, vehicles: [], locations: [] };
    await adminDb.doc(`tenants/${tid}/job_reports/fleet_refresh_latest`).set(queued);
    void refreshTenantFleet(tid, 'manual').catch(error => {
      console.error(JSON.stringify({ event: 'fleet.refresh.manual_failed', tenantId: tid, error: (error as Error).message }));
    });
    res.status(202).json({ ok: true, data: queued });
  } catch (error) { fail(res, error); }
});
liveMapRouter.get('/refresh/latest', requireInternalUser, async (req, res) => {
  try { res.set('Cache-Control', 'no-store').json({ ok: true, data: await latestTenantFleetRefresh(tenant(req)) }); }
  catch (error) { fail(res, error); }
});
liveMapRouter.post('/tags/:id/refresh', async (req, res) => {
  try {
    const tid = tenant(req); const tagId = String(req.params.id);
    if (req.authUser?.role === 'client') {
      const vehicle = await adminDb.collection(`tenants/${tid}/vehicles`).where('tagId', '==', tagId).where('clientId', '==', req.authUser.clientId).limit(1).get();
      if (vehicle.empty) return res.status(404).json({ ok: false, error: 'Tag não encontrada.' });
    }
    res.set('Cache-Control', 'no-store').json({ ok: true, data: await refreshSingleTagResult(tid, tagId) });
  } catch (error: any) {
    res.status(error?.status || 502).json({ ok: false, error: error?.message || 'Falha ao atualizar a tag.', errorCode: 'TAG_REFRESH_FAILED' });
  }
});
liveMapRouter.get('/', async (req, res) => { try {
  const tid = tenant(req); const ids = await clientVehicleIds(req);
  let entry = liveMapCache.get(tid);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (!entry?.loading) {
      const loading = (async () => {
        const vehicles = await adminDb.collection(`tenants/${tid}/vehicles`).get();
        const linkedTagVehicles = new Map(vehicles.docs.filter(doc => doc.get('tagId')).map(doc => [String(doc.get('tagId')), doc]));
        const tagCounts = new Map<string, number>();
        vehicles.docs.forEach(doc => { const tagId = String(doc.get('tagId') || ''); if (tagId) tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1); });
        tagCounts.forEach((count, tagId) => { if (count > 1) linkedTagVehicles.delete(tagId); });
        const linkedTrackerVehicles = new Map(vehicles.docs.filter(doc => doc.get('trackerId')).map(doc => [String(doc.get('trackerId')), doc]));
        const items = await xadTagRepository.list(tid);
        const authorized = items.filter(item => linkedTagVehicles.has(item.id)
          && item.lastPosition && afterVehicleLink(Date.parse(item.lastPosition.fixTime || item.lastPosition.deviceTime || item.lastPosition.serverTime || ''), linkedTagVehicles.get(item.id)?.get('trackingLinkedAt')));
        const data: any[] = authorized.map(item => {
          const asset = xadTagService.toLiveMap(item);
          return asset ? { ...asset, linkedEntityId: linkedTagVehicles.get(item.id)!.id } : null;
        }).filter(Boolean);
        const ktagSnap = await adminDb.collection(`tenants/${tid}/tags`).where('type', '==', 'K_TAG').get();
        for (const tag of ktagSnap.docs) {
          const vehicle = linkedTagVehicles.get(tag.id); const point = tag.get('lastPosition');
          if (!vehicle || !point || point.tagId !== tag.id || !Number.isFinite(point.timestamp)
            || !afterVehicleLink(point.timestamp, vehicle.get('trackingLinkedAt'))) continue;
          data.push({ id: `ktag_${tag.id}`, equipmentId: tag.id, equipmentType: 'K_TAG', source: point.provider || 'ktag',
            tenantId: tid, uniqueId: String(tag.get('traccarUniqueId') || tag.get('accessoryId') || ''),
            traccarDeviceId: tag.get('traccarDeviceId') || null, linkedEntityId: vehicle.id,
            latitude: point.lat, longitude: point.lon, valid: true, fixTime: new Date(point.timestamp).toISOString(),
            address: point.address || null, speed: point.speed, course: point.course, altitude: point.altitude,
            status: Date.now() - point.timestamp <= 300_000 ? 'online' : 'delayed', attributes: {} });
        }
        const trackers = await adminDb.collection(`tenants/${tid}/trackers`).get();
        const linked = trackers.docs.filter(doc => linkedTrackerVehicles.get(doc.id)?.id === doc.get('vehicleId') && Number.isInteger(doc.get('traccarDeviceId')));
        if (linked.length) {
          const positions = await traccarClient.getLatestPositions().catch(error => {
            console.error('Falha ao consultar posições de rastreadores no Traccar:', error);
            return [];
          });
          const byDevice = new Map(positions.map(position => [position.deviceId, position]));
          for (const tracker of linked) {
            const raw = byDevice.get(tracker.get('traccarDeviceId'));
            if (!raw) continue;
            data.push({ id: `tracker_${tracker.id}`, equipmentId: tracker.id, equipmentType: 'TRACKER', source: 'traccar', tenantId: tid,
              imei: tracker.id, uniqueId: tracker.id, traccarDeviceId: raw.deviceId, linkedEntityId: tracker.get('vehicleId'),
              status: Date.now() - Date.parse(raw.fixTime || raw.serverTime || '') <= 300_000 ? 'online' : 'delayed', latitude: raw.latitude, longitude: raw.longitude, altitude: raw.altitude, speed: raw.speed,
              course: raw.course, valid: raw.valid, deviceTime: raw.deviceTime, fixTime: raw.fixTime, serverTime: raw.serverTime,
              attributes: raw.attributes || {} });
          }
        }
        return data;
      })();
      entry = { expiresAt: 0, data: [], loading };
      liveMapCache.set(tid, entry);
      loading.then(data => liveMapCache.set(tid, { expiresAt: Date.now() + LIVE_MAP_CACHE_TTL_MS, data }))
        .catch(() => { if (liveMapCache.get(tid)?.loading === loading) liveMapCache.delete(tid); });
    }
    entry = liveMapCache.get(tid)!;
    if (entry.loading) await entry.loading;
    entry = liveMapCache.get(tid)!;
  }
  const data = ids ? entry.data.filter(item => ids.has(String(item.linkedEntityId))) : entry.data;
  res.set('Cache-Control', 'private, max-age=5').json({ ok: true, data });
} catch (error) { fail(res, error); } });
liveMapRouter.get('/tags/:id/history', async (req, res) => {
  const requestId = crypto.randomUUID(); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Request-Id', requestId);
  try {
    if (req.authUser?.role === 'client') return res.status(403).json({ ok: false, error: 'Permissão insuficiente.' });
    res.json({ ok: true, data: await trackingHistoryService.forTag(tenant(req), String(req.params.id), req.query as Record<string, unknown>, requestId) });
  } catch (error: any) {
    const mapped = error instanceof HistoryRequestError ? error : new HistoryRequestError('Falha ao consultar histórico.', 502, 'PROVIDER_UNAVAILABLE');
    res.status(mapped.status).json({ ok: false, requestId, errorCode: mapped.code, error: mapped.message });
  }
});
