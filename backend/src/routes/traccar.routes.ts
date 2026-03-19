/**
 * traccar.routes.ts — Rotas do BFF que expõem dados do Traccar
 *
 * Todas as rotas exigem autenticação via Bearer Token.
 * O frontend usa VITE_BACKEND_API_URL + /api/traccar/...
 */

import { Request, Router } from 'express';
import * as traccar from '../services/traccar.js';
import { traccarInstancesService } from '../services/traccarInstances.js';

// Auth is handled centrally in app.ts for all /api/* routes.
const router = Router();
export { router as traccarRouter };

const adminRoles = new Set(['admin', 'moderator']);

const getCompanySlugFromRequest = (req: Request) => {
  const querySlug = typeof req.query?.companySlug === 'string' ? req.query.companySlug.trim().toLowerCase() : '';
  const sessionSlug = req.authSession?.companySlug?.trim().toLowerCase() ?? '';

  if (querySlug && querySlug !== sessionSlug && !adminRoles.has(req.authSession?.role ?? '')) {
    const error = new Error('Sem permissão para consultar outra empresa.');
    (error as any).statusCode = 403;
    throw error;
  }

  return querySlug || sessionSlug;
};

const resolveApi = async (req: Request) => {
  const companySlug = getCompanySlugFromRequest(req);
  const connection = await traccarInstancesService.resolveConnectionConfig(companySlug);
  return traccar.createTraccarApi(connection);
};

// ─────────────────────────────────────────
// GET /api/traccar/server
// Verifica se o Traccar está online
// ─────────────────────────────────────────
router.get('/server', async (_req, res) => {
  try {
    const api = await resolveApi(_req);
    const info = await api.getServerInfo();
    res.json(info);
  } catch (err: any) {
    res.status(err?.statusCode || 502).json({ error: 'Traccar indisponível', detail: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/traccar/devices
// Lista todos os dispositivos GPS
// ─────────────────────────────────────────
router.get('/devices', async (_req, res) => {
  try {
    const api = await resolveApi(_req);
    const devices = await api.getDevices();
    res.json(devices);
  } catch (err: any) {
    res.status(err?.statusCode || 502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/traccar/positions
// Posições atuais (todas ou de um dispositivo)
// Query: ?deviceId=123
// ─────────────────────────────────────────
router.get('/positions', async (req, res) => {
  try {
    const api = await resolveApi(req);
    const deviceId = req.query.deviceId ? Number(req.query.deviceId) : undefined;
    const positions = await api.getPositions(deviceId);
    res.json(positions);
  } catch (err: any) {
    res.status(err?.statusCode || 502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/traccar/positions/history
// Histórico de posições num intervalo
// Query: ?deviceId=123&from=ISO&to=ISO
// ─────────────────────────────────────────
router.get('/positions/history', async (req, res) => {
  const { deviceId, from, to } = req.query as Record<string, string>;

  if (!deviceId || !from || !to) {
    return res.status(400).json({ error: 'deviceId, from e to são obrigatórios' });
  }

  try {
    const api = await resolveApi(req);
    const history = await api.getPositionHistory(
      Number(deviceId),
      new Date(from),
      new Date(to),
    );
    res.json(history);
  } catch (err: any) {
    res.status(err?.statusCode || 502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/traccar/geofences
// Lista todas as geofences
// ─────────────────────────────────────────
router.get('/geofences', async (_req, res) => {
  try {
    const api = await resolveApi(_req);
    const geofences = await api.getGeofences();
    res.json(geofences);
  } catch (err: any) {
    res.status(err?.statusCode || 502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/traccar/geofences
// Cria uma geofence
// Body: { name, area (WKT), description? }
// ─────────────────────────────────────────
router.post('/geofences', async (req, res) => {
  try {
    const api = await resolveApi(req);
    const geofence = await api.createGeofence(req.body);
    res.status(201).json(geofence);
  } catch (err: any) {
    res.status(err?.statusCode || 502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// DELETE /api/traccar/geofences/:id
// ─────────────────────────────────────────
router.delete('/geofences/:id', async (req, res) => {
  try {
    const api = await resolveApi(req);
    await api.deleteGeofence(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(err?.statusCode || 502).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/traccar/events
// Eventos de um dispositivo num intervalo
// Query: ?deviceId=123&from=ISO&to=ISO
// ─────────────────────────────────────────
router.get('/events', async (req, res) => {
  const { deviceId, from, to } = req.query as Record<string, string>;

  if (!deviceId || !from || !to) {
    return res.status(400).json({ error: 'deviceId, from e to são obrigatórios' });
  }

  try {
    const api = await resolveApi(req);
    const events = await api.getEvents(
      Number(deviceId),
      new Date(from),
      new Date(to),
    );
    res.json(events);
  } catch (err: any) {
    res.status(err?.statusCode || 502).json({ error: err.message });
  }
});


