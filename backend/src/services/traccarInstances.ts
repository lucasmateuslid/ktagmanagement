import { env } from '../config/env.js';
import { firestore } from './firestore.js';
import type { TraccarConnectionConfig } from './traccar.js';

const collectionName = 'ktag_traccar_instances';

export interface TraccarInstance {
  id: string;
  name: string;
  companySlug: string;
  url: string;
  user: string;
  pass: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TraccarInstanceSafe extends Omit<TraccarInstance, 'pass'> {
  hasPassword: boolean;
}

export type TraccarInstanceInput = {
  name: string;
  companySlug: string;
  url: string;
  user: string;
  pass?: string;
  active?: boolean;
};

const toSafe = (instance: TraccarInstance): TraccarInstanceSafe => ({
  id: instance.id,
  name: instance.name,
  companySlug: instance.companySlug,
  url: instance.url,
  user: instance.user,
  active: instance.active,
  createdAt: instance.createdAt,
  updatedAt: instance.updatedAt,
  hasPassword: Boolean(instance.pass),
});

const normalizeSlug = (value: string) => value.trim().toLowerCase();
const normalizeUrl = (value: string) => value.trim().replace(/\/$/, '');

const defaultConnectionConfig = (): TraccarConnectionConfig => ({
  url: env.traccar.url,
  user: env.traccar.user,
  pass: env.traccar.pass,
});

const fromDoc = (id: string, data: Record<string, unknown>): TraccarInstance => ({
  id,
  name: String(data.name ?? 'Traccar'),
  companySlug: normalizeSlug(String(data.companySlug ?? 'default')),
  url: normalizeUrl(String(data.url ?? env.traccar.url)),
  user: String(data.user ?? env.traccar.user),
  pass: String(data.pass ?? ''),
  active: Boolean(data.active ?? true),
  createdAt: Number(data.createdAt ?? Date.now()),
  updatedAt: Number(data.updatedAt ?? Date.now()),
});

const listInstancesRaw = async (): Promise<TraccarInstance[]> => {
  const snapshot = await firestore.collection(collectionName).get();
  return snapshot.docs
    .map((doc) => fromDoc(doc.id, doc.data() as Record<string, unknown>))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

const getInstanceRaw = async (id: string): Promise<TraccarInstance | null> => {
  const docRef = firestore.collection(collectionName).doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) return null;
  return fromDoc(docSnap.id, docSnap.data() as Record<string, unknown>);
};

export const traccarInstancesService = {
  async listSafe(): Promise<TraccarInstanceSafe[]> {
    const instances = await listInstancesRaw();
    return instances.map(toSafe);
  },

  async getSafeById(id: string): Promise<TraccarInstanceSafe | null> {
    const instance = await getInstanceRaw(id);
    return instance ? toSafe(instance) : null;
  },

  async upsert(id: string | null, input: TraccarInstanceInput): Promise<TraccarInstanceSafe> {
    const now = Date.now();
    const collectionRef = firestore.collection(collectionName);
    const docRef = id ? collectionRef.doc(id) : collectionRef.doc();
    const existing = id ? await getInstanceRaw(id) : null;

    const payload: Omit<TraccarInstance, 'id'> = {
      name: input.name.trim(),
      companySlug: normalizeSlug(input.companySlug),
      url: normalizeUrl(input.url),
      user: input.user.trim(),
      pass: input.pass !== undefined ? input.pass : (existing?.pass ?? ''),
      active: input.active ?? existing?.active ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await docRef.set(payload, { merge: true });
    return toSafe({ id: docRef.id, ...payload });
  },

  async delete(id: string): Promise<void> {
    await firestore.collection(collectionName).doc(id).delete();
  },

  async resolveConnectionConfig(companySlug?: string): Promise<TraccarConnectionConfig> {
    const slug = (companySlug ?? '').trim().toLowerCase();
    if (!slug) {
      return defaultConnectionConfig();
    }

    const snapshot = await firestore
      .collection(collectionName)
      .where('companySlug', '==', slug)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return defaultConnectionConfig();
    }

    const instance = fromDoc(snapshot.docs[0].id, snapshot.docs[0].data() as Record<string, unknown>);
    return {
      url: instance.url,
      user: instance.user,
      pass: instance.pass,
    };
  },

  async resolveConnectionConfigById(id: string): Promise<TraccarConnectionConfig> {
    const instance = await getInstanceRaw(id);
    if (!instance) {
      throw new Error('Instância não encontrada.');
    }

    return {
      url: instance.url,
      user: instance.user,
      pass: instance.pass,
    };
  }
};
