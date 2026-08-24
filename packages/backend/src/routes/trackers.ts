import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import type { ManagedTracker, TrackerModel } from '@ktag/shared';
import { requireAuth, requireInternalUser, requirePermission } from '../middleware/auth.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { isValidTrackerImei, normalizeTrackerImei } from '../domain/tracker.js';

const DEFAULT_MODELS: TrackerModel[] = [
  ...[
    ['Suntech','ST340U','suntech'], ['Suntech','ST4315','suntech'],
    ['Teltonika','FMB920','teltonika'], ['Teltonika','FMC920','teltonika'], ['Teltonika','FMB130','teltonika'], ['Teltonika','FMC130','teltonika'],
    ['Queclink','GV55','gl200'], ['Queclink','GV55 Lite','gl200'], ['Queclink','GV300','gl200'], ['Queclink','GV300N','gl200'], ['Queclink','GV500','gl200'], ['Queclink','GMT100','gl200'],
    ['Coban','TK303B','gps103'], ['Coban','TK303G','gps103'], ['Coban','GPS303','gps103'], ['Coban','GPS306','gps103'],
    ['Concox','GT06N','gt06'], ['Concox','J16','gt06'], ['Concox','JM-VL03','gt06'],
    ['Meitrack','T1','meitrack'], ['Meitrack','T366G','meitrack'], ['Meitrack','MVT600','meitrack'],
    ['Jimi IoT','VL03','gt06'], ['Jimi IoT','VL103M','gt06'],
    ['Xexun','TK102-2','xexun'], ['Xexun','TK103-2','xexun'],
    ['Totem','TZ-AVL05','totem'], ['Totem','TZ-GT08','totem'],
  ].map(([manufacturer, name, protocol]) => ({
    id: `${manufacturer}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), manufacturer, name, protocol,
    connectivity: [], powerType: '12v' as const, active: true, source: 'traccar' as const, sourceUrl: 'https://www.traccar.org/devices/',
  })),
];

const tenantId = (req: any) => {
  const id = String(req.tenantId || '');
  if (!id || id === 'admin' || id === '__apex__') throw new Error('Empresa inválida.');
  return id;
};

export const trackersRouter = Router();
trackersRouter.use(requireAuth, requireInternalUser);
trackersRouter.use(requirePermission('ROUTE_ASSETS', ['admin', 'moderator']));

trackersRouter.get('/models', async (_req, res) => {
  const snap = await adminDb.collection('tracker_models').where('active', '==', true).get();
  const custom = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackerModel));
  const byId = new Map(DEFAULT_MODELS.map(model => [model.id, model]));
  custom.forEach(model => byId.set(model.id, model));
  res.json({ ok: true, data: [...byId.values()].sort((a, b) => `${a.manufacturer} ${a.name}`.localeCompare(`${b.manufacturer} ${b.name}`)) });
});

trackersRouter.get('/available-sim-cards', async (req, res) => {
  const snap = await adminDb.collection(`tenants/${tenantId(req)}/sim_cards`).get();
  const rows = snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(item => !item.trackerId && ['in_stock', 'returned'].includes(String(item.status || 'in_stock')))
    .sort((a, b) => String(a.phoneNumber || a.iccid).localeCompare(String(b.phoneNumber || b.iccid)));
  res.json({ ok: true, data: rows });
});

trackersRouter.get('/', async (req, res) => {
  const snap = await adminDb.collection(`tenants/${tenantId(req)}/trackers`).orderBy('createdAt', 'desc').get();
  res.json({ ok: true, data: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
});

async function createTracker(tid: string, body: any, userId: string): Promise<ManagedTracker> {
  const imei = normalizeTrackerImei(body?.imei);
  if (!isValidTrackerImei(imei)) throw Object.assign(new Error(`IMEI inválido: ${body?.imei || 'vazio'}.`), { status: 400 });
  const modelId = String(body?.modelId || '').trim();
  const modelsSnap = await adminDb.collection('tracker_models').doc(modelId).get();
  const model = modelsSnap.exists ? ({ id: modelsSnap.id, ...modelsSnap.data() } as TrackerModel) : DEFAULT_MODELS.find(item => item.id === modelId);
  if (!model?.active) throw Object.assign(new Error('Modelo global inválido ou inativo.'), { status: 400 });
  const ref = adminDb.doc(`tenants/${tid}/trackers/${imei}`);
  if ((await ref.get()).exists) throw Object.assign(new Error(`IMEI ${imei} já cadastrado nesta empresa.`), { status: 409 });

  const simCardId = body?.simCardId ? String(body.simCardId) : '';
  let simRef: FirebaseFirestore.DocumentReference | null = null;
  if (simCardId) {
    simRef = adminDb.doc(`tenants/${tid}/sim_cards/${simCardId}`);
    const sim = await simRef.get();
    if (!sim.exists || sim.get('trackerId')) throw Object.assign(new Error('Chip inexistente ou já vinculado.'), { status: 409 });
  }
  const minVoltage = body?.minBatteryVoltage === '' || body?.minBatteryVoltage == null ? undefined : Number(body.minBatteryVoltage);
  const maxVoltage = body?.maxBatteryVoltage === '' || body?.maxBatteryVoltage == null ? undefined : Number(body.maxBatteryVoltage);
  if ((minVoltage != null && (!Number.isFinite(minVoltage) || minVoltage < 0)) || (maxVoltage != null && (!Number.isFinite(maxVoltage) || maxVoltage < 0)) || (minVoltage != null && maxVoltage != null && minVoltage > maxVoltage)) {
    throw Object.assign(new Error('Faixa de voltagem inválida.'), { status: 400 });
  }
  const now = Date.now();
  const tracker: ManagedTracker = {
    id: imei, imei, modelId: model.id, modelName: model.name, manufacturer: model.manufacturer,
    status: 'disponível', simCardId: simCardId || undefined,
    invertedLockOutput: body?.invertedLockOutput === true,
    password: body?.password ? String(body.password).trim().slice(0, 80) : undefined,
    minBatteryVoltage: minVoltage, maxBatteryVoltage: maxVoltage,
    purchaseDate: body?.purchaseDate ? String(body.purchaseDate) : undefined,
    purchaseValue: body?.purchaseValue === '' || body?.purchaseValue == null ? undefined : Math.max(0, Number(body.purchaseValue) || 0),
    supplierId: body?.supplierId ? String(body.supplierId) : undefined,
    warrantyMonths: body?.warrantyMonths === '' || body?.warrantyMonths == null ? undefined : Math.max(0, Math.trunc(Number(body.warrantyMonths) || 0)),
    stockId: String(body?.stockId || '').trim().slice(0, 80),
    batch: body?.batch ? String(body.batch).trim().slice(0, 80) : undefined,
    serialNumber: body?.serialNumber ? String(body.serialNumber).trim().slice(0, 80) : undefined,
    notes: body?.notes ? String(body.notes).trim().slice(0, 500) : undefined,
    createdAt: now, updatedAt: now,
  };
  if (!tracker.stockId) throw Object.assign(new Error('Estoque é obrigatório.'), { status: 400 });
  await ref.create(Object.fromEntries(Object.entries(tracker).filter(([, value]) => value !== undefined)));
  if (simRef) await simRef.update({ trackerId: imei, status: 'reserved', updatedAt: now });
  await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId, tenantId: tid, event: 'tracker.created', action: 'CREATE', entity: 'Tracker', entityId: imei, timestamp: FieldValue.serverTimestamp() });
  return tracker;
}

trackersRouter.post('/', async (req, res) => {
  const tid = tenantId(req);
  const imei = normalizeTrackerImei(req.body?.imei);
  if (!isValidTrackerImei(imei)) return res.status(400).json({ ok: false, error: 'IMEI deve conter exatamente 15 dígitos.' });
  try { res.status(201).json({ ok: true, data: await createTracker(tid, req.body, req.authUser!.uid) }); }
  catch (error: any) { res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao cadastrar rastreador.' }); }
});

trackersRouter.post('/batch', async (req, res) => {
  const tid = tenantId(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length || items.length > 500) return res.status(400).json({ ok: false, error: 'Informe entre 1 e 500 equipamentos.' });
  const created: ManagedTracker[] = []; const errors: Array<{ row: number; error: string }> = [];
  for (let index = 0; index < items.length; index += 1) {
    try { created.push(await createTracker(tid, { ...req.body.defaults, ...items[index], simCardId: undefined }, req.authUser!.uid)); }
    catch (error: any) { errors.push({ row: index + 1, error: error.message }); }
  }
  res.status(created.length ? 201 : 200).json({ ok: true, data: { created: created.length, errors } });
});

trackersRouter.patch('/:id', async (req, res) => {
  const tid = tenantId(req);
  const ref = adminDb.doc(`tenants/${tid}/trackers/${req.params.id}`);
  try {
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: 'Rastreador não encontrado.' });

    const current = snap.data() as ManagedTracker;
    const modelId = String(req.body?.modelId || '').trim();
    const modelSnap = await adminDb.collection('tracker_models').doc(modelId).get();
    const model = modelSnap.exists ? ({ id: modelSnap.id, ...modelSnap.data() } as TrackerModel) : DEFAULT_MODELS.find(item => item.id === modelId);
    if (!model?.active) return res.status(400).json({ ok: false, error: 'Modelo global inválido ou inativo.' });

    const minVoltage = req.body?.minBatteryVoltage === '' || req.body?.minBatteryVoltage == null ? undefined : Number(req.body.minBatteryVoltage);
    const maxVoltage = req.body?.maxBatteryVoltage === '' || req.body?.maxBatteryVoltage == null ? undefined : Number(req.body.maxBatteryVoltage);
    if ((minVoltage != null && (!Number.isFinite(minVoltage) || minVoltage < 0)) || (maxVoltage != null && (!Number.isFinite(maxVoltage) || maxVoltage < 0)) || (minVoltage != null && maxVoltage != null && minVoltage > maxVoltage)) {
      return res.status(400).json({ ok: false, error: 'Faixa de voltagem inválida.' });
    }
    const stockId = String(req.body?.stockId || '').trim().slice(0, 80);
    if (!stockId) return res.status(400).json({ ok: false, error: 'Estoque é obrigatório.' });

    const nextSimId = req.body?.simCardId ? String(req.body.simCardId) : '';
    const previousSimId = current.simCardId || '';
    const now = Date.now();
    await adminDb.runTransaction(async transaction => {
      const nextSimRef = nextSimId ? adminDb.doc(`tenants/${tid}/sim_cards/${nextSimId}`) : null;
      const previousSimRef = previousSimId && previousSimId !== nextSimId ? adminDb.doc(`tenants/${tid}/sim_cards/${previousSimId}`) : null;
      if (nextSimRef && nextSimId !== previousSimId) {
        const nextSim = await transaction.get(nextSimRef);
        if (!nextSim.exists || nextSim.get('trackerId')) throw Object.assign(new Error('Chip inexistente ou já vinculado.'), { status: 409 });
      }
      transaction.update(ref, {
        modelId: model.id, modelName: model.name, manufacturer: model.manufacturer,
        simCardId: nextSimId || FieldValue.delete(),
        invertedLockOutput: req.body?.invertedLockOutput === true,
        password: req.body?.password ? String(req.body.password).trim().slice(0, 80) : FieldValue.delete(),
        minBatteryVoltage: minVoltage ?? FieldValue.delete(), maxBatteryVoltage: maxVoltage ?? FieldValue.delete(),
        purchaseDate: req.body?.purchaseDate ? String(req.body.purchaseDate) : FieldValue.delete(),
        purchaseValue: req.body?.purchaseValue === '' || req.body?.purchaseValue == null ? FieldValue.delete() : Math.max(0, Number(req.body.purchaseValue) || 0),
        supplierId: req.body?.supplierId ? String(req.body.supplierId) : FieldValue.delete(),
        warrantyMonths: req.body?.warrantyMonths === '' || req.body?.warrantyMonths == null ? FieldValue.delete() : Math.max(0, Math.trunc(Number(req.body.warrantyMonths) || 0)),
        stockId, batch: req.body?.batch ? String(req.body.batch).trim().slice(0, 80) : FieldValue.delete(),
        serialNumber: req.body?.serialNumber ? String(req.body.serialNumber).trim().slice(0, 80) : FieldValue.delete(),
        notes: req.body?.notes ? String(req.body.notes).trim().slice(0, 500) : FieldValue.delete(), updatedAt: now,
      });
      if (previousSimRef) transaction.update(previousSimRef, { trackerId: FieldValue.delete(), status: 'in_stock', updatedAt: now });
      if (nextSimRef && nextSimId !== previousSimId) transaction.update(nextSimRef, { trackerId: current.imei, status: 'reserved', updatedAt: now });
    });
    await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId: req.authUser!.uid, tenantId: tid, event: 'tracker.updated', action: 'UPDATE', entity: 'Tracker', entityId: req.params.id, timestamp: FieldValue.serverTimestamp() });
    const updated = await ref.get();
    res.json({ ok: true, data: { id: updated.id, ...updated.data() } });
  } catch (error: any) {
    res.status(error.status || 500).json({ ok: false, error: error.message || 'Falha ao editar rastreador.' });
  }
});

trackersRouter.delete('/:id', async (req, res) => {
  const tid = tenantId(req);
  const ref = adminDb.doc(`tenants/${tid}/trackers/${req.params.id}`);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: 'Rastreador não encontrado.' });
  if (snap.get('vehicleId') || snap.get('status') === 'em_uso') return res.status(409).json({ ok: false, error: 'Desvincule o rastreador antes de excluí-lo.' });
  const simCardId = snap.get('simCardId');
  const now = Date.now();
  await adminDb.runTransaction(async transaction => {
    transaction.delete(ref);
    if (simCardId) transaction.update(adminDb.doc(`tenants/${tid}/sim_cards/${simCardId}`), { trackerId: FieldValue.delete(), status: 'in_stock', updatedAt: now });
  });
  await adminDb.collection(`tenants/${tid}/audit_logs`).add({ userId: req.authUser!.uid, tenantId: tid, event: 'tracker.deleted', action: 'DELETE', entity: 'Tracker', entityId: req.params.id, timestamp: FieldValue.serverTimestamp() });
  res.json({ ok: true, data: { id: req.params.id } });
});
