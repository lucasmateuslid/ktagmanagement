import { Router } from 'express';
import { traccarGet, traccarPost, traccarDelete } from '../services/traccarClient.js';
import { broadcastPosition, broadcastEvent } from '../services/positionBroadcast.js';
import type { TraccarDevice, TraccarPosition } from '@ktag/shared';

// ── REST: /api/tracking/* ─────────────────────────────────────────────────────
export const trackingRouter = Router();

// GET /api/tracking/devices
trackingRouter.get('/devices', async (req, res) => {
  try {
    const devices = await traccarGet<TraccarDevice[]>('/devices');
    res.json({ data: devices, ok: true });
  } catch (err: any) {
    console.error('[TRACKING] GET /devices:', err.message);
    res.status(502).json({ error: err.message, ok: false });
  }
});

// POST /api/tracking/devices  — body: { name, uniqueId, phone?, model?, category? }
trackingRouter.post('/devices', async (req, res) => {
  try {
    const { name, uniqueId, phone, model, category } = req.body ?? {};
    if (!name || !uniqueId) {
      return res.status(400).json({ error: 'name e uniqueId são obrigatórios', ok: false });
    }
    const device = await traccarPost<TraccarDevice>('/devices', {
      name,
      uniqueId,
      phone: phone ?? '',
      model: model ?? '',
      category: category ?? '',
      attributes: {},
    });
    res.status(201).json({ data: device, ok: true });
  } catch (err: any) {
    console.error('[TRACKING] POST /devices:', err.message);
    res.status(502).json({ error: err.message, ok: false });
  }
});

// DELETE /api/tracking/devices/:id
trackingRouter.delete('/devices/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido', ok: false });
    await traccarDelete(`/devices/${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[TRACKING] DELETE /devices/:id:', err.message);
    res.status(502).json({ error: err.message, ok: false });
  }
});

// GET /api/tracking/devices/:id/position
trackingRouter.get('/devices/:id/position', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido', ok: false });
    const positions = await traccarGet<TraccarPosition[]>(`/positions?deviceId=${id}`);
    res.json({ data: positions[0] ?? null, ok: true });
  } catch (err: any) {
    console.error('[TRACKING] GET /devices/:id/position:', err.message);
    res.status(502).json({ error: err.message, ok: false });
  }
});

// GET /api/tracking/devices/:id/history?from=ISO&to=ISO
trackingRouter.get('/devices/:id/history', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido', ok: false });
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if (!from || !to) {
      return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios (ISO 8601)', ok: false });
    }
    const positions = await traccarGet<TraccarPosition[]>(
      `/reports/route?deviceId=${id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    res.json({ data: positions, ok: true });
  } catch (err: any) {
    console.error('[TRACKING] GET /devices/:id/history:', err.message);
    res.status(502).json({ error: err.message, ok: false });
  }
});

// POST /api/tracking/devices/:id/command  — body: { type, attributes? }
trackingRouter.post('/devices/:id/command', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido', ok: false });
    const { type, attributes } = req.body ?? {};
    if (!type) return res.status(400).json({ error: 'type é obrigatório', ok: false });
    const command = await traccarPost('/commands/send', {
      deviceId: id,
      type,
      attributes: attributes ?? {},
    });
    res.json({ data: command, ok: true });
  } catch (err: any) {
    console.error('[TRACKING] POST /devices/:id/command:', err.message);
    res.status(502).json({ error: err.message, ok: false });
  }
});

// ── Internal: /api/internal/traccar/* ────────────────────────────────────────
// Chamado pelo Traccar via forward.url — protegido por X-Internal-Secret
export const internalTraccarRouter = Router();

internalTraccarRouter.use((req, res, next) => {
  const secret = process.env.INTERNAL_SECRET;
  if (secret && req.headers['x-internal-secret'] !== secret) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!secret) {
    console.warn('[INTERNAL] INTERNAL_SECRET não configurado — endpoint sem autenticação');
  }
  next();
});

// POST /api/internal/traccar/position
internalTraccarRouter.post('/position', (req, res) => {
  const position = req.body as TraccarPosition;
  if (!position?.deviceId) return res.status(400).json({ error: 'payload inválido' });
  // Futuramente: resolver tenantId pelo traccarDeviceId em ktag.tracker_devices
  const tenantId = (req.headers['x-tenant-id'] as string | undefined) ?? 'dev-tenant';
  broadcastPosition(tenantId, position);
  res.status(204).send();
});

// POST /api/internal/traccar/event
internalTraccarRouter.post('/event', (req, res) => {
  const tenantId = (req.headers['x-tenant-id'] as string | undefined) ?? 'dev-tenant';
  broadcastEvent(tenantId, req.body);
  res.status(204).send();
});
