import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { FieldValue } from 'firebase-admin/firestore';
import type { ManagedTracker } from '@ktag/shared';
import { requireAuth, getEnabledTenantModules } from '../middleware/auth.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { assertTrackerDevice, getBlockingProfile } from '../services/managedTrackerService.js';
import { traccarClient, TraccarHttpError } from '../services/traccarClient.js';
import { isSafeToBlock } from '../domain/blocking.js';

export const blockingRouter = Router();
blockingRouter.use(requireAuth);
const problem = (status: number, message: string) => Object.assign(new Error(message), { status });
const tenantId = (req: any) => {
  const tid = String(req.tenantId || '');
  if (!tid || tid === 'admin' || tid === '__apex__') throw problem(400, 'Empresa inválida.');
  return tid;
};
const manager = (req: any) => {
  const user = req.authUser;
  return Boolean(user && ['admin', 'moderator'].includes(user.role) && (user.permissions === null || user.permissions.includes('ACTION_TRACKER_BLOCK')));
};
const fail = (res: any, error: any) => res.status(error?.status || 502).json({ ok: false, error: error?.status ? error.message : 'Não foi possível consultar ou comandar o rastreador.' });

async function context(req: any) {
  const tid = tenantId(req);
  const [tenant, modules, vehicle] = await Promise.all([
    adminDb.doc(`tenants/${tid}`).get(),
    getEnabledTenantModules(tid, req.headers.authorization || ''),
    adminDb.doc(`tenants/${tid}/vehicles/${req.params.vehicleId}`).get(),
  ]);
  if (!tenant.exists || tenant.get('active') === false || !modules.includes('trackers')) throw problem(403, 'Módulo não liberado para esta empresa.');
  if (!vehicle.exists) throw problem(404, 'Veículo não encontrado.');
  const role = req.authUser?.role;
  if (role === 'client') {
    if (!req.authUser.clientId || vehicle.get('clientId') !== req.authUser.clientId) throw problem(404, 'Veículo não encontrado.');
    const client = await adminDb.doc(`tenants/${tid}/clients/${req.authUser.clientId}`).get();
    if (!client.exists || client.get('hasAccess') !== true || vehicle.get('clientBlockingAllowed') !== true) throw problem(403, 'Bloqueio não autorizado para este veículo.');
  } else if (!manager(req)) throw problem(403, 'Permissão insuficiente.');
  if (tenant.get('settings.blockingEnabled') !== true) throw problem(403, 'Bloqueio não liberado para esta empresa.');
  const trackerId = String(vehicle.get('trackerId') || '');
  if (!trackerId) throw problem(409, 'Veículo sem rastreador vinculado.');
  const trackerSnap = await adminDb.doc(`tenants/${tid}/trackers/${trackerId}`).get();
  if (!trackerSnap.exists || trackerSnap.get('vehicleId') !== vehicle.id || trackerSnap.get('blockingEnabled') !== true) throw problem(409, 'Rastreador sem bloqueio habilitado.');
  const tracker = { id: trackerSnap.id, ...trackerSnap.data() } as ManagedTracker;
  const profile = await getBlockingProfile(tracker.modelId);
  if (!profile || tracker.blockingProfileId !== tracker.modelId) throw problem(409, 'Modelo sem homologação válida.');
  const device = await assertTrackerDevice(tid, tracker);
  if (device.attributes?.ktagBlockingEnabled !== true) throw problem(409, 'Habilitação pendente de sincronização com o Traccar.');
  return { tid, vehicle, tracker, profile, device };
}

blockingRouter.patch('/clients/:clientId/vehicles/:vehicleId', async (req, res) => {
  try {
    if (!manager(req)) throw problem(403, 'Permissão insuficiente.');
    if (typeof req.body?.allowed !== 'boolean') throw problem(400, 'Informe allowed como booleano.');
    const tid = tenantId(req);
    const [tenant, client] = await Promise.all([adminDb.doc(`tenants/${tid}`).get(), adminDb.doc(`tenants/${tid}/clients/${req.params.clientId}`).get()]);
    if (req.body.allowed && (tenant.get('settings.blockingEnabled') !== true || !client.exists || client.get('hasAccess') !== true)) throw problem(403, 'Empresa ou cliente sem autorização para bloqueio.');
    const ref = adminDb.doc(`tenants/${tid}/vehicles/${req.params.vehicleId}`);
    const vehicle = await ref.get();
    if (!vehicle.exists || vehicle.get('clientId') !== req.params.clientId) throw problem(404, 'Veículo não encontrado para este cliente.');
    await ref.update({ clientBlockingAllowed: req.body.allowed, updatedAt: Date.now() });
    await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId: req.authUser!.uid, event: 'vehicle.client_blocking.changed', entityId: ref.id, clientId: req.params.clientId, allowed: req.body.allowed, timestamp: FieldValue.serverTimestamp() });
    res.json({ ok: true, data: { vehicleId: ref.id, allowed: req.body.allowed } });
  } catch (error) { fail(res, error); }
});

blockingRouter.get('/vehicles/:vehicleId', async (req, res) => {
  try {
    const { device, tid, vehicle } = await context(req);
    const operation = await adminDb.doc(`tenants/${tid}/blocking_operations/${vehicle.id}`).get();
    res.set('Cache-Control', 'no-store').json({ ok: true, data: { enabled: true, online: device.status === 'online', lastCommand: operation.exists ? operation.data() : null } });
  } catch (error) { fail(res, error); }
});

const commandLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
  keyGenerator: req => `${req.tenantId}:${req.authUser?.uid}:${req.params.vehicleId}` });
blockingRouter.post('/vehicles/:vehicleId/commands', commandLimiter, async (req, res) => {
  let operationRef: FirebaseFirestore.DocumentReference | null = null;
  let operationId = '';
  let acquired = false;
  try {
    const action = req.body?.action;
    if (action !== 'block' && action !== 'unblock') throw problem(400, 'Ação inválida.');
    if (req.body?.confirmed !== true) throw problem(400, 'Confirmação necessária.');
    const { tid, vehicle, tracker, profile, device } = await context(req);
    if (device.status !== 'online') throw problem(409, 'Rastreador offline. Tente novamente quando estiver online.');
    if (action === 'block') {
      const position = await traccarClient.getLatestPositionForDevice(device.id);
      if (!isSafeToBlock(position)) {
        throw problem(409, 'Bloqueio exige posição válida dos últimos 2 minutos e veículo parado.');
      }
    }
    const command = action === 'block' ? profile.block : profile.unblock;
    const available = await traccarClient.getCommandTypes(device.id);
    if (!available.includes(command.type)) throw problem(409, 'Comando não suportado pelo protocolo atual.');
    operationRef = adminDb.doc(`tenants/${tid}/blocking_operations/${vehicle.id}`);
    operationId = crypto.randomUUID();
    await adminDb.runTransaction(async tx => {
      const tenantRef = adminDb.doc(`tenants/${tid}`);
      const vehicleRef = adminDb.doc(`tenants/${tid}/vehicles/${vehicle.id}`);
      const trackerRef = adminDb.doc(`tenants/${tid}/trackers/${tracker.id}`);
      const clientRef = req.authUser!.role === 'client' ? adminDb.doc(`tenants/${tid}/clients/${req.authUser!.clientId}`) : null;
      const [current, latestTenant, latestVehicle, latestTracker, latestClient] = await Promise.all([
        tx.get(operationRef!), tx.get(tenantRef), tx.get(vehicleRef), tx.get(trackerRef), clientRef ? tx.get(clientRef) : Promise.resolve(null),
      ]);
      if (latestTenant.get('settings.blockingEnabled') !== true || latestVehicle.get('trackerId') !== tracker.id
        || latestTracker.get('vehicleId') !== vehicle.id || latestTracker.get('blockingEnabled') !== true
        || (clientRef && (latestVehicle.get('clientId') !== req.authUser!.clientId || latestVehicle.get('clientBlockingAllowed') !== true || latestClient?.get('hasAccess') !== true))) {
        throw problem(403, 'Autorização de bloqueio alterada. Atualize a tela.');
      }
      if (Number(current.get('pendingUntil') || 0) > Date.now()) throw problem(409, 'Outro comando ainda está em andamento.');
      if (current.get('action') === action && current.get('status') === 'sent' && Date.now() - Number(current.get('sentAt') || 0) < 60_000) throw problem(409, 'Este comando já foi enviado recentemente. Aguarde antes de repetir.');
      if (current.get('action') === action && current.get('status') === 'unknown' && Date.now() - Number(current.get('failedAt') || 0) < 300_000) throw problem(409, 'Resultado anterior incerto. Aguarde antes de repetir o comando.');
      tx.set(operationRef!, { operationId, action, status: 'sending', pendingUntil: Date.now() + 30_000, requestedAt: Date.now(), requestedBy: req.authUser!.uid, role: req.authUser!.role, trackerId: tracker.id, deviceId: device.id });
    });
    acquired = true;
    await traccarClient.sendCommand(device.id, command.type, command.attributes || {});
    await operationRef.update({ status: 'sent', pendingUntil: 0, sentAt: Date.now() });
    await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId: req.authUser!.uid, event: `tracker.${action}.sent`, entityId: vehicle.id, trackerId: tracker.id, operationId, timestamp: FieldValue.serverTimestamp() });
    res.set('Cache-Control', 'no-store').json({ ok: true, data: { operationId, status: 'sent', message: 'Comando enviado; confirmação física depende do protocolo.' } });
  } catch (error: any) {
    if (operationRef && operationId && acquired) {
      const unknown = !(error instanceof TraccarHttpError);
      await operationRef.update({ status: unknown ? 'unknown' : 'failed', pendingUntil: 0, failedAt: Date.now(), error: unknown ? 'Resultado do envio incerto.' : 'Traccar recusou o comando.' }).catch(() => undefined);
      await adminDb.collection(`tenants/${req.tenantId}/audit_logs`).add({ userId: req.authUser!.uid, event: unknown ? 'tracker.command.unknown' : 'tracker.command.failed', entityId: req.params.vehicleId, operationId, timestamp: FieldValue.serverTimestamp() }).catch(() => undefined);
    }
    fail(res, error);
  }
});
