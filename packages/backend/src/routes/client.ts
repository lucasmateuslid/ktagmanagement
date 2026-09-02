import { Router } from 'express';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { adminDb } from '../services/firebaseAdmin.js';
import { decryptTenantValue } from '../services/vehicleSearch.js';

export const clientRouter = Router();
clientRouter.use(requireAuth, requireRoles('client'));

export const clientFleetVehicleDto = (tenantId: string, id: string, v: Record<string, any>) => ({
  id, type: v.type, plate: decryptTenantValue(tenantId, v.plate), model: v.model, year: v.year,
  color: v.color, tagId: v.tagId, clientId: v.clientId, status: v.status,
  installationType: v.installationType, createdAt: v.createdAt, lastPosition: v.lastPosition,
});

clientRouter.get('/fleet', async (req, res) => {
  const tenantId = req.tenantId || '';
  const clientId = req.authUser?.clientId;
  if (!tenantId || !clientId) return res.status(403).json({ ok: false, error: 'Vínculo de cliente inválido.' });

  const vehiclesSnap = await adminDb.collection(`tenants/${tenantId}/vehicles`).where('clientId', '==', clientId).get();
  const vehicles = vehiclesSnap.docs.map(doc => clientFleetVehicleDto(tenantId, doc.id, doc.data()));
  const tagIds = [...new Set(vehicles.map(v => v.tagId).filter(Boolean))] as string[];
  const tagDocs = await Promise.all(tagIds.map(id => adminDb.doc(`tenants/${tenantId}/tags/${id}`).get()));
  const tags = tagDocs.filter(doc => doc.exists).map(doc => {
    const t = doc.data()!;
    return { id: doc.id, name: t.name, type: t.type, equipmentType: t.equipmentType, accessoryId: t.identifierOriginal || t.accessoryId, identifierOriginal: t.identifierOriginal };
  });
  const categoryIds = [...new Set(vehicles.map(v => v.type).filter(Boolean))];
  const categoryDocs = await Promise.all(categoryIds.map(id => adminDb.doc(`tenants/${tenantId}/categories/${id}`).get()));
  const categories = categoryDocs.filter(doc => doc.exists).map(doc => ({ id: doc.id, ...doc.data() }));
  res.json({ ok: true, data: { vehicles, tags, categories } });
});
