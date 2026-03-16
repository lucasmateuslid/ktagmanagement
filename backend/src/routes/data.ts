import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { firestore } from '../services/firestore.js';

const usersCollection = 'ktag_users_db';
const vehiclesCollection = 'ktag_vehicles';
const clientsCollection = 'ktag_clients';
const schedulesCollection = 'ktag_schedules';
const auditLogsCollection = 'ktag_audit_logs';

const findUserQuerySchema = z.object({
  email: z.string().email()
});

const userStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected'])
});

const schedulesQuerySchema = z.object({
  role: z.string().optional(),
  userId: z.string().optional()
});

const auditLogsQuerySchema = z.object({
  count: z.coerce.number().min(1).max(5000).optional()
});

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || '';

export const dataRouter = Router();

dataRouter.get('/users/find', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = findUserQuerySchema.parse(req.query);
    const cleanEmail = email.trim().toLowerCase();

    const snapshot = await firestore
      .collection(usersCollection)
      .where('email', '==', cleanEmail)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json(null);
    }

    const doc = snapshot.docs[0];
    return res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    next(error);
  }
});

dataRouter.get('/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = await firestore.collection(usersCollection).get();
    return res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    next(error);
  }
});

dataRouter.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    await firestore.collection(usersCollection).doc(id).set(req.body || {}, { merge: true });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

dataRouter.patch('/users/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    const { status } = userStatusSchema.parse(req.body);
    await firestore.collection(usersCollection).doc(id).set({ status }, { merge: true });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

dataRouter.get('/vehicles', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = await firestore.collection(vehiclesCollection).get();
    return res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    next(error);
  }
});

dataRouter.put('/vehicles/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    await firestore.collection(vehiclesCollection).doc(id).set(req.body || {}, { merge: true });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

dataRouter.patch('/vehicles/:id/position', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    await firestore.collection(vehiclesCollection).doc(id).set({ lastPosition: req.body?.location }, { merge: true });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

dataRouter.get('/clients', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = await firestore.collection(clientsCollection).get();
    return res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    next(error);
  }
});

dataRouter.put('/clients/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    await firestore.collection(clientsCollection).doc(id).set(req.body || {}, { merge: true });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

dataRouter.get('/schedules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, userId } = schedulesQuerySchema.parse(req.query);

    let queryRef: FirebaseFirestore.Query = firestore.collection(schedulesCollection);
    if (role === 'user' && userId) {
      queryRef = queryRef.where('requesterId', '==', userId);
    }

    const snapshot = await queryRef.get();
    return res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    next(error);
  }
});

dataRouter.put('/schedules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    await firestore.collection(schedulesCollection).doc(id).set(req.body || {}, { merge: true });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

dataRouter.delete('/schedules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = firstParam(req.params.id);
    await firestore.collection(schedulesCollection).doc(id).delete();
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

dataRouter.post('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logEntry = req.body || {};
    await firestore.collection(auditLogsCollection).add(logEntry);
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

dataRouter.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { count } = auditLogsQuerySchema.parse(req.query);
    const snapshot = await firestore
      .collection(auditLogsCollection)
      .orderBy('timestamp', 'desc')
      .limit(count || 100)
      .get();

    return res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    next(error);
  }
});
