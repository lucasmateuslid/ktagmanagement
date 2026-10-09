import { Router } from 'express';
import { requireAuth, requireGlobalAdmin } from '../middleware/auth.js';
import { getTraccarConfig, validateTraccarConfig } from '../config/traccar.js';
import { traccarClient } from '../services/traccarClient.js';
import { traccarRealtimeService } from '../services/traccarRealtimeService.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export const adminTraccarRouter = Router();
adminTraccarRouter.use(requireAuth, requireGlobalAdmin);
adminTraccarRouter.get('/blocking-profiles', async (_req, res) => {
  const snap = await adminDb.collection('tracker_blocking_profiles').get();
  res.json({ ok: true, data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
});
adminTraccarRouter.put('/blocking-profiles/:modelId', async (req, res) => {
  const modelId = String(req.params.modelId || '');
  const validCommand = (value: any) => value && typeof value.type === 'string' && /^[a-zA-Z][a-zA-Z0-9]{1,40}$/.test(value.type)
    && (value.attributes === undefined || (value.attributes && typeof value.attributes === 'object' && !Array.isArray(value.attributes)
      && Object.keys(value.attributes).length <= 10 && Object.entries(value.attributes).every(([key, item]) => /^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(key) && key !== 'noQueue' && (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'))));
  if (!/^[a-z0-9-]{3,100}$/.test(modelId) || !validCommand(req.body?.block) || !validCommand(req.body?.unblock) || typeof req.body?.approved !== 'boolean') return res.status(400).json({ ok: false, error: 'Perfil inválido.' });
  const data = { modelId, approved: req.body.approved, block: { type: req.body.block.type, attributes: req.body.block.attributes || {} }, unblock: { type: req.body.unblock.type, attributes: req.body.unblock.attributes || {} }, verifiedAt: req.body.approved ? Date.now() : null, verifiedBy: req.authUser!.uid, updatedAt: Date.now() };
  await adminDb.doc(`tracker_blocking_profiles/${modelId}`).set(data);
  await adminDb.collection('platform_audit_logs').add({ userId: req.authUser!.uid, event: 'tracker.profile.updated', modelId, approved: data.approved, timestamp: FieldValue.serverTimestamp() });
  res.json({ ok: true, data });
});
adminTraccarRouter.get('/status', async (_req, res) => {
  const cfg = getTraccarConfig(); const errors = validateTraccarConfig(cfg); const started = Date.now(); let reachable = false; let authenticated = false;
  try { await traccarClient.health(); reachable = true; } catch { /* diagnostic */ }
  try { await traccarClient.request('/devices?limit=1', { operation: 'adminAuthTest' }); authenticated = true; } catch { /* diagnostic */ }
  res.json({ ok: true, data: { configured: errors.length === 0, reachable, authenticated, rest: { connected: reachable && authenticated, latencyMs: Date.now() - started }, realtime: traccarRealtimeService.diagnostics, webUrl: cfg.webUrl || null } });
});
adminTraccarRouter.post('/test', async (_req, res) => { const started = Date.now(); try { await traccarClient.request('/devices?limit=1', { operation: 'adminConnectionTest' }); res.json({ ok: true, data: { connected: true, latencyMs: Date.now() - started } }); } catch (error) { res.status(502).json({ ok: false, error: (error as Error).message }); } });
adminTraccarRouter.post('/test-websocket', async (_req, res) => { try { await traccarRealtimeService.start(); res.json({ ok: true, data: traccarRealtimeService.diagnostics }); } catch (error) { res.status(502).json({ ok: false, error: (error as Error).message }); } });
adminTraccarRouter.post('/test-write', async (_req, res) => { const cfg = getTraccarConfig(); if (!cfg.writeTestEnabled) return res.status(403).json({ ok: false, error: 'Teste de escrita desabilitado por configuração.' }); const uniqueId = `99999${Date.now()}`.slice(-15).padStart(15, '9'); let id: number | undefined; try { const device = await traccarClient.createDevice({ name: `KTagFinder-write-test-${Date.now()}`, uniqueId, disabled: true, model: 'TEST', category: 'TEST', attributes: { platformSource: cfg.platformSource, temporary: true } }); id = device.id; await traccarClient.getDevice(id); res.json({ ok: true, data: { created: true, read: true, cleaned: true } }); } catch (error) { res.status(502).json({ ok: false, error: (error as Error).message }); } finally { if (id) await traccarClient.deleteDevice(id).catch(() => undefined); } });
