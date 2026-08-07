import { Router } from 'express';
import { requireAuth, requireGlobalAdmin } from '../middleware/auth.js';
import { getTraccarConfig, validateTraccarConfig } from '../config/traccar.js';
import { traccarClient } from '../services/traccarClient.js';
import { traccarRealtimeService } from '../services/traccarRealtimeService.js';

export const adminTraccarRouter = Router();
adminTraccarRouter.use(requireAuth, requireGlobalAdmin);
adminTraccarRouter.get('/status', async (_req, res) => {
  const cfg = getTraccarConfig(); const errors = validateTraccarConfig(cfg); const started = Date.now(); let reachable = false; let authenticated = false;
  try { await traccarClient.health(); reachable = true; } catch { /* diagnostic */ }
  try { await traccarClient.request('/devices?limit=1', { operation: 'adminAuthTest' }); authenticated = true; } catch { /* diagnostic */ }
  res.json({ ok: true, data: { configured: errors.length === 0, reachable, authenticated, rest: { connected: reachable && authenticated, latencyMs: Date.now() - started }, realtime: traccarRealtimeService.diagnostics, webUrl: cfg.webUrl || null } });
});
adminTraccarRouter.post('/test', async (_req, res) => { const started = Date.now(); try { await traccarClient.request('/devices?limit=1', { operation: 'adminConnectionTest' }); res.json({ ok: true, data: { connected: true, latencyMs: Date.now() - started } }); } catch (error) { res.status(502).json({ ok: false, error: (error as Error).message }); } });
adminTraccarRouter.post('/test-websocket', async (_req, res) => { try { await traccarRealtimeService.start(); res.json({ ok: true, data: traccarRealtimeService.diagnostics }); } catch (error) { res.status(502).json({ ok: false, error: (error as Error).message }); } });
adminTraccarRouter.post('/test-write', async (_req, res) => { const cfg = getTraccarConfig(); if (!cfg.writeTestEnabled) return res.status(403).json({ ok: false, error: 'Teste de escrita desabilitado por configuração.' }); const uniqueId = `99999${Date.now()}`.slice(-15).padStart(15, '9'); let id: number | undefined; try { const device = await traccarClient.createDevice({ name: `KTagFinder-write-test-${Date.now()}`, uniqueId, disabled: true, model: 'TEST', category: 'TEST', attributes: { platformSource: cfg.platformSource, temporary: true } }); id = device.id; await traccarClient.getDevice(id); res.json({ ok: true, data: { created: true, read: true, cleaned: true } }); } catch (error) { res.status(502).json({ ok: false, error: (error as Error).message }); } finally { if (id) await traccarClient.deleteDevice(id).catch(() => undefined); } });
