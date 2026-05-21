
// Camada de dados tenant-aware. Todos os acessos a Firestore passam por
// lib/firestore.ts (tenantCollection/tenantDoc), garantindo que dados de um
// tenant nunca apareçam em outro.
//
// O activeTenant é populado pelo TenantContext no boot; storage não recebe
// tenantId em cada método (evita reescrever 30+ páginas), mas falha alto se
// for chamado antes da inicialização.

import { Tag, Vehicle, User, LocationHistory, AppSettings, Company, VehicleCategory, StolenRecord, Client, AuditLog, AppNotification, Schedule, Technician, Feedback, SystemUpdate, Shipment, ShippingAddress } from '../types';
import { db, auth } from './firebase';
import {
  getDocs, addDoc, updateDoc, deleteDoc,
  query, where, setDoc, getDoc, orderBy, limit, getDocsFromCache, onSnapshot,
  CollectionReference, Query
} from 'firebase/firestore';
import { tenantCollection, tenantDoc, systemDoc } from '../lib/firestore';
import { activeTenant } from './activeTenant';
import { encryption } from './encryption';
import { securityService } from './security';

// Integrações configuradas no nível da plataforma pelo super admin
// (/ktag_settings_v3/platform_integrations). Hoje só carrega o proxy/relay
// compartilhado — endpoints e tokens (K-TAG URL, Traqcare etc.) continuam
// sob controle de cada tenant.
export interface PlatformIntegrations {
  proxyUrl?: string;       // Cloud Function que faz bypass de CORS
  updatedAt?: number;
}

const PLATFORM_INTEGRATIONS_DOC = 'platform_integrations';
const PLATFORM_INTEGRATIONS_CACHE_KEY = 'platform_integrations';

// Nomes de coleção (curtos — já namespacedos sob /tenants/{id}).
const COLLECTIONS = {
  USERS: 'users',
  TAGS: 'tags',
  TRACKERS: 'trackers',
  VEHICLES: 'vehicles',
  CLIENTS: 'clients',
  SETTINGS: 'settings',
  COMPANIES: 'companies',
  CATEGORIES: 'categories',
  STOLEN_RECORDS: 'stolen_records',
  AUDIT_LOGS: 'audit_logs',
  SCHEDULES: 'schedules',
  TECHNICIANS: 'technicians',
  FEEDBACKS: 'feedbacks',
  SYSTEM_UPDATES: 'system_updates',
  SHIPMENTS: 'shipments',
  SHIPPING_ADDRESSES: 'shipping_addresses',
  TECHNICIAN_PAYMENTS: 'technician_payments',
  CUSTOM_ROLES: 'custom_roles',
  PUBLIC_SETTINGS: 'public_settings',
};

// Subconjunto público de AppSettings — apenas whitelabel/tema, sem segredos.
// Espelhado em /tenants/{tid}/public_settings/whitelabel pelo saveSettings
// para que telas pré-login (Login, WhitelabelStyles) possam ler sem auth.
export type PublicSettings = Pick<AppSettings,
  'customAppName' | 'customLogoUrlLight' | 'customLogoUrlDark'
  | 'customLogoBase64Light' | 'customLogoBase64Dark'
  | 'themeColors'
>;

const PUBLIC_SETTINGS_DOC = 'whitelabel';

function pickPublicSettings(s: AppSettings): PublicSettings {
  return {
    customAppName: s.customAppName,
    customLogoUrlLight: s.customLogoUrlLight,
    customLogoUrlDark: s.customLogoUrlDark,
    customLogoBase64Light: s.customLogoBase64Light,
    customLogoBase64Dark: s.customLogoBase64Dark,
    themeColors: s.themeColors,
  };
}

// Cache em localStorage, prefixado por tenant para evitar leakage entre tenants
// na mesma máquina (dev/preview com múltiplos subdomínios).
function tenantCacheKey(name: string): string {
  const tid = activeTenant.isReady() ? activeTenant.id : 'pretenant';
  return `ktag_${tid}_${name}`;
}

const cache = {
  get: <T>(name: string, def: T): T => {
    try {
      const item = localStorage.getItem(tenantCacheKey(name));
      return item ? JSON.parse(item) : def;
    } catch (e) { return def; }
  },
  set: (name: string, value: any) => {
    try { localStorage.setItem(tenantCacheKey(name), JSON.stringify(value)); } catch (e) { /* quota or disabled */ }
  },
  remove: (name: string) => {
    try { localStorage.removeItem(tenantCacheKey(name)); } catch (e) { /* noop */ }
  },
};

const cleanData = <T extends Record<string, any>>(data: T): T => {
  const copy = { ...data };
  Object.keys(copy).forEach(key => {
    if (copy[key] === undefined || copy[key] === null) delete copy[key];
  });
  return copy;
};

// Fetch resiliente: tenta server, cai para cache do SDK em caso de erro/offline.
const fetchResilient = async (col: CollectionReference) => {
  if (!db) return [];
  try {
    const snap = await getDocs(col);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    try {
      const snap = await getDocsFromCache(col);
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    } catch (cacheErr) {
      return [];
    }
  }
};

export const storage = {
  // initEncryption / *SessionUser são no-ops de compat. Firebase Auth gerencia
  // a sessão; TenantContext já inicializa a criptografia derivada do tenantId.
  // Mantidos para não quebrar imports residuais — remover quando todas as
  // referências externas tiverem sido migradas.
  initEncryption: async (_user?: User) => {
    return;
  },

  // Resolve o usuário atual via Firebase Auth + lookup no doc do tenant.
  // Usado por logAction quando o caller não passa o user explicitamente.
  getSessionUser: async (): Promise<User | null> => {
    if (!auth?.currentUser || !db) return null;
    try {
      const snap = await getDoc(tenantDoc(COLLECTIONS.USERS, auth.currentUser.uid));
      if (!snap.exists()) return null;
      const raw = { ...snap.data(), id: snap.id } as User;
      await encryption.waitReady();
      return {
        ...raw,
        name: raw.name ? await encryption.decrypt(raw.name) : raw.name,
        cpf: raw.cpf ? await encryption.decrypt(raw.cpf) : undefined,
      };
    } catch (e) {
      return null;
    }
  },

  setSessionUser: async (_user: User) => {
    // No-op — Firebase Auth gerencia o token de sessão.
  },

  clearSessionUser: async () => {
    // Limpa apenas o cache local do tenant ativo. Firebase Auth signOut() é
    // feito pelo AuthContext.
    const keysToKeep = ['ktag_theme', 'ktag_remember_login'];
    Object.keys(localStorage).forEach(k => {
      if (keysToKeep.includes(k)) return;
      const tid = activeTenant.isReady() ? activeTenant.id : null;
      if (tid && k.startsWith(`ktag_${tid}_`)) {
        localStorage.removeItem(k);
      }
    });
  },

  // --- GESTÃO DE USUÁRIOS ---
  findUserByEmail: async (email: string, decrypt = true): Promise<User | null> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!db) return null;
    try {
      const q = query(tenantCollection(COLLECTIONS.USERS), where("email", "==", cleanEmail));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const userData = { ...snap.docs[0].data(), id: snap.docs[0].id } as User;
      if (decrypt) {
        return {
          ...userData,
          name: await encryption.decrypt(userData.name),
          cpf: userData.cpf ? await encryption.decrypt(userData.cpf) : undefined
        };
      }
      return userData;
    } catch (e) {
      console.error("DB User Lookup Error", e);
      return null;
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    const data = await fetchResilient(tenantCollection(COLLECTIONS.USERS)) as User[];
    return Promise.all(data.map(async u => ({
      ...u,
      name: await encryption.decrypt(u.name),
      cpf: u.cpf ? await encryption.decrypt(u.cpf) : undefined
    })));
  },

  registerUserRequest: async (user: User) => {
    // Garante que o usuário pertença ao tenant ativo.
    const userWithTenant = { ...user, tenantId: user.tenantId || activeTenant.id };
    const encryptedUser = {
      ...userWithTenant,
      name: await encryption.encrypt(userWithTenant.name),
      cpf: userWithTenant.cpf ? await encryption.encrypt(userWithTenant.cpf) : undefined
    };
    if (db) await setDoc(tenantDoc(COLLECTIONS.USERS, user.id), cleanData(encryptedUser));
    await storage.logAction(null, 'CREATE', 'User', `Solicitação de cadastro: ${user.name} (${user.email})`, user.id);
  },

  updateUserProfile: async (id: string, data: Partial<User>) => {
    if (db) {
      const userRef = tenantDoc(COLLECTIONS.USERS, id);
      const encryptedData: Partial<User> = { ...data };
      if (data.name) encryptedData.name = await encryption.encrypt(data.name);
      if (data.cpf) encryptedData.cpf = await encryption.encrypt(data.cpf);
      await updateDoc(userRef, cleanData(encryptedData as Record<string, any>));
      await storage.logAction(null, 'UPDATE', 'User', `Perfil atualizado: ${id}`, id);
    }
  },

  updateUserStatus: async (id: string, status: User['status']) => {
    if (db) {
      const userRef = tenantDoc(COLLECTIONS.USERS, id);
      await updateDoc(userRef, { status });
      await storage.logAction(null, 'UPDATE', 'User', `Status alterado para ${status}`, id);
    }
  },

  deleteUser: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.USERS, id));
      await storage.logAction(null, 'DELETE', 'User', `Usuário removido: ${id}`, id);
    }
  },

  // --- VEHICLES ---
  getVehicles: async (): Promise<Vehicle[]> => {
    const raw = await fetchResilient(tenantCollection(COLLECTIONS.VEHICLES)) as Vehicle[];
    if (raw.length > 0) cache.set(COLLECTIONS.VEHICLES, raw);
    await encryption.waitReady();
    return Promise.all(raw.map(async v => ({
      ...v,
      plate: await encryption.decrypt(v.plate),
      chassis: v.chassis ? await encryption.decrypt(v.chassis) : undefined
    })));
  },

  saveVehicle: async (v: Vehicle) => {
    await encryption.waitReady();
    const encryptedVehicle = {
      ...v,
      plate: await encryption.encrypt(v.plate),
      chassis: v.chassis ? await encryption.encrypt(v.chassis) : undefined,
      plateHash: await securityService.generateSearchIndex(v.plate)
    };
    if (db) await setDoc(tenantDoc(COLLECTIONS.VEHICLES, v.id), cleanData(encryptedVehicle));
    const list = cache.get<Vehicle[]>(COLLECTIONS.VEHICLES, []);
    const idx = list.findIndex(item => item.id === v.id);
    const isNew = idx < 0;
    if (idx >= 0) list[idx] = encryptedVehicle as Vehicle; else list.push(encryptedVehicle as Vehicle);
    cache.set(COLLECTIONS.VEHICLES, list);
    await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Vehicle', `${isNew ? 'Cadastro' : 'Atualização'} de veículo: ${v.plate}`, v.id);
  },

  updateVehiclePosition: async (vehicleId: string, location: LocationHistory) => {
    if (!db) return;
    try {
      await updateDoc(tenantDoc(COLLECTIONS.VEHICLES, vehicleId), { lastPosition: location });
    } catch (e) {
      console.warn("Falha ao persistir localização (offline ou erro):", e);
    }
  },

  subscribeVehicles: (callback: (vehicles: Vehicle[]) => void) => {
    if (!db) return () => {};
    return onSnapshot(tenantCollection(COLLECTIONS.VEHICLES), async (snap) => {
      const raw = snap.docs.map(d => ({ ...d.data(), id: d.id })) as Vehicle[];
      await encryption.waitReady();
      const decrypted = await Promise.all(raw.map(async v => ({
        ...v,
        plate: await encryption.decrypt(v.plate),
        chassis: v.chassis ? await encryption.decrypt(v.chassis) : undefined
      })));
      callback(decrypted);
    });
  },

  deleteVehicle: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.VEHICLES, id));
      await storage.logAction(null, 'DELETE', 'Vehicle', `Veículo removido: ${id}`, id);
    }
  },

  // --- CLIENTS ---
  getClients: async (): Promise<Client[]> => {
    const raw = await fetchResilient(tenantCollection(COLLECTIONS.CLIENTS)) as Client[];
    if (raw.length > 0) cache.set(COLLECTIONS.CLIENTS, raw);
    await encryption.waitReady();
    return Promise.all(raw.map(async c => ({
      ...c,
      name: await encryption.decrypt(c.name),
      cpf: await encryption.decrypt(c.cpf),
      phone: await encryption.decrypt(c.phone),
      email: c.email ? await encryption.decrypt(c.email) : undefined,
      address: c.address ? await encryption.decrypt(c.address) : undefined
    })));
  },

  saveClient: async (c: Client) => {
    await encryption.waitReady();
    const encryptedClient = {
      ...c,
      name: await encryption.encrypt(c.name),
      cpf: await encryption.encrypt(c.cpf),
      phone: await encryption.encrypt(c.phone),
      email: c.email ? await encryption.encrypt(c.email) : undefined,
      address: c.address ? await encryption.encrypt(c.address) : undefined,
      cpfHash: await securityService.generateSearchIndex(c.cpf)
    };
    if (db) await setDoc(tenantDoc(COLLECTIONS.CLIENTS, c.id), cleanData(encryptedClient));
    const list = cache.get<Client[]>(COLLECTIONS.CLIENTS, []);
    const idx = list.findIndex(item => item.id === c.id);
    const isNew = idx < 0;
    if (idx >= 0) list[idx] = encryptedClient as Client; else list.push(encryptedClient as Client);
    cache.set(COLLECTIONS.CLIENTS, list);
    await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Client', `${isNew ? 'Cadastro' : 'Atualização'} de cliente: ${c.name}`, c.id);
  },

  deleteClient: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.CLIENTS, id));
      await storage.logAction(null, 'DELETE', 'Client', `Cliente removido: ${id}`, id);
    }
  },

  // --- TAGS ---
  getTags: async (): Promise<Tag[]> => {
    const raw = await fetchResilient(tenantCollection(COLLECTIONS.TAGS)) as Tag[];
    if (raw.length > 0) cache.set(COLLECTIONS.TAGS, raw);
    await encryption.waitReady();
    return Promise.all(raw.map(async t => {
      let imei = t.imei;
      if (imei && imei.length > 30) {
        try { imei = await encryption.decrypt(imei); } catch (e) { /* tag pode estar não-criptografada */ }
      }
      return {
        ...t,
        imei,
        hashedAdvKey: t.hashedAdvKey ? await encryption.decrypt(t.hashedAdvKey) : undefined,
        privateKey: t.privateKey ? await encryption.decrypt(t.privateKey) : undefined
      };
    }));
  },

  subscribeTags: (callback: (tags: Tag[]) => void) => {
    if (!db) return () => {};
    return onSnapshot(tenantCollection(COLLECTIONS.TAGS), async (snap) => {
      const raw = snap.docs.map(d => ({ ...d.data(), id: d.id })) as Tag[];
      await encryption.waitReady();
      const decrypted = await Promise.all(raw.map(async t => {
        let imei = t.imei;
        if (imei && imei.length > 30) {
          try { imei = await encryption.decrypt(imei); } catch (e) { /* não-criptografada */ }
        }
        return {
          ...t,
          imei,
          hashedAdvKey: t.hashedAdvKey ? await encryption.decrypt(t.hashedAdvKey) : undefined,
          privateKey: t.privateKey ? await encryption.decrypt(t.privateKey) : undefined
        };
      }));
      callback(decrypted);
    });
  },

  saveTag: async (t: Tag) => {
    await encryption.waitReady();
    const encryptedTag = {
      ...t,
      imei: t.imei,
      hashedAdvKey: t.hashedAdvKey ? await encryption.encrypt(t.hashedAdvKey) : undefined,
      privateKey: t.privateKey ? await encryption.encrypt(t.privateKey) : undefined
    };
    if (db) await setDoc(tenantDoc(COLLECTIONS.TAGS, t.id), cleanData(encryptedTag));
    const tags = cache.get<Tag[]>(COLLECTIONS.TAGS, []);
    const idx = tags.findIndex(item => item.id === t.id);
    const isNew = idx < 0;
    if (idx >= 0) tags[idx] = encryptedTag as Tag; else tags.push(encryptedTag as Tag);
    cache.set(COLLECTIONS.TAGS, tags);
    await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Tag', `${isNew ? 'Cadastro' : 'Atualização'} de tag: ${t.id}`, t.id);
  },

  deleteTag: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.TAGS, id));
      await storage.logAction(null, 'DELETE', 'Tag', `Tag removida: ${id}`, id);
    }
  },

  // --- COMPANIES (regionais internas do tenant) ---
  getCompanies: async (): Promise<Company[]> => {
    const data = await fetchResilient(tenantCollection(COLLECTIONS.COMPANIES)) as Company[];
    if (data.length > 0) cache.set(COLLECTIONS.COMPANIES, data);
    return data;
  },

  saveCompany: async (c: Company) => {
    if (db) {
      const isNew = !(await getDoc(tenantDoc(COLLECTIONS.COMPANIES, c.id))).exists();
      await setDoc(tenantDoc(COLLECTIONS.COMPANIES, c.id), cleanData(c));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Company', `${isNew ? 'Cadastro' : 'Atualização'} de regional: ${c.name}`, c.id);
    }
    const list = cache.get<Company[]>(COLLECTIONS.COMPANIES, []);
    const idx = list.findIndex(item => item.id === c.id);
    if (idx >= 0) list[idx] = c; else list.push(c);
    cache.set(COLLECTIONS.COMPANIES, list);
  },

  deleteCompany: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.COMPANIES, id));
      await storage.logAction(null, 'DELETE', 'Company', `Regional removida: ${id}`, id);
    }
    const list = cache.get<Company[]>(COLLECTIONS.COMPANIES, []);
    cache.set(COLLECTIONS.COMPANIES, list.filter(c => c.id !== id));
  },

  // --- CATEGORIES ---
  getCategories: async (): Promise<VehicleCategory[]> => {
    const data = await fetchResilient(tenantCollection(COLLECTIONS.CATEGORIES)) as VehicleCategory[];
    if (data.length > 0) cache.set(COLLECTIONS.CATEGORIES, data);
    return data;
  },

  saveCategory: async (cat: VehicleCategory) => {
    if (db) {
      const isNew = !(await getDoc(tenantDoc(COLLECTIONS.CATEGORIES, cat.id))).exists();
      await setDoc(tenantDoc(COLLECTIONS.CATEGORIES, cat.id), cleanData(cat));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Category', `${isNew ? 'Cadastro' : 'Atualização'} de categoria: ${cat.name}`, cat.id);
    }
    const list = cache.get<VehicleCategory[]>(COLLECTIONS.CATEGORIES, []);
    const idx = list.findIndex(item => item.id === cat.id);
    if (idx >= 0) list[idx] = cat; else list.push(cat);
    cache.set(COLLECTIONS.CATEGORIES, list);
  },

  deleteCategory: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.CATEGORIES, id));
      await storage.logAction(null, 'DELETE', 'Category', `Categoria removida: ${id}`, id);
    }
    const list = cache.get<VehicleCategory[]>(COLLECTIONS.CATEGORIES, []);
    cache.set(COLLECTIONS.CATEGORIES, list.filter(c => c.id !== id));
  },

  // --- STOLEN RECORDS ---
  getStolenRecords: async (): Promise<StolenRecord[]> => {
    const data = await fetchResilient(tenantCollection(COLLECTIONS.STOLEN_RECORDS)) as StolenRecord[];
    if (data.length > 0) cache.set(COLLECTIONS.STOLEN_RECORDS, data);
    return data;
  },

  reportTheft: async (record: StolenRecord) => {
    if (db) {
      await setDoc(tenantDoc(COLLECTIONS.STOLEN_RECORDS, record.id), cleanData(record));
      await updateDoc(tenantDoc(COLLECTIONS.VEHICLES, record.vehicleId), { status: 'stolen' });
    }
    const list = cache.get<StolenRecord[]>(COLLECTIONS.STOLEN_RECORDS, []);
    list.push(record);
    cache.set(COLLECTIONS.STOLEN_RECORDS, list);
  },

  recoverTheft: async (recordId: string, recoveredValue: number) => {
    if (db) {
      const recordRef = tenantDoc(COLLECTIONS.STOLEN_RECORDS, recordId);
      const recordSnap = await getDoc(recordRef);
      if (recordSnap.exists()) {
        const record = recordSnap.data() as StolenRecord;
        await updateDoc(recordRef, {
          status: 'recovered',
          recoveredAt: Date.now(),
          recoveredValue
        });
        await updateDoc(tenantDoc(COLLECTIONS.VEHICLES, record.vehicleId), { status: 'active' });
      }
    }
    const list = cache.get<StolenRecord[]>(COLLECTIONS.STOLEN_RECORDS, []);
    const idx = list.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      list[idx].status = 'recovered';
      list[idx].recoveredAt = Date.now();
      list[idx].recoveredValue = recoveredValue;
      cache.set(COLLECTIONS.STOLEN_RECORDS, list);
    }
  },

  getStolenRecordByToken: async (token: string): Promise<StolenRecord | null> => {
    if (!db) return null;
    const q = query(tenantCollection(COLLECTIONS.STOLEN_RECORDS), where("trackingToken", "==", token), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { ...snap.docs[0].data(), id: snap.docs[0].id } as StolenRecord;
  },

  markAsLost: async (recordId: string, vehicleId: string) => {
    if (db) {
      await updateDoc(tenantDoc(COLLECTIONS.STOLEN_RECORDS, recordId), {
        status: 'lost',
        lostAt: Date.now()
      });
      await updateDoc(tenantDoc(COLLECTIONS.VEHICLES, vehicleId), { status: 'inactive' });
    }
  },

  getPublicVehicleLocation: async (vehicleId: string): Promise<LocationHistory | null> => {
    if (!db) return null;
    const snap = await getDoc(tenantDoc(COLLECTIONS.VEHICLES, vehicleId));
    if (snap.exists()) {
      const data = snap.data() as Vehicle;
      return data.lastPosition || null;
    }
    return null;
  },

  getLocations: async (_tagId: string): Promise<LocationHistory[]> => {
    return [];
  },

  // --- PLATFORM INTEGRATIONS (cross-tenant — super admin configura) ---
  getPlatformIntegrations: async (): Promise<PlatformIntegrations> => {
    if (db) {
      try {
        const snap = await getDoc(systemDoc('ktag_settings_v3', PLATFORM_INTEGRATIONS_DOC));
        if (snap.exists()) {
          const data = snap.data() as PlatformIntegrations;
          cache.set(PLATFORM_INTEGRATIONS_CACHE_KEY, data);
          return data;
        }
      } catch (e: any) {
        if (e?.code !== 'permission-denied') {
          console.warn('Platform integrations fetch failed, fallback ao cache.');
        }
      }
    }
    return cache.get<PlatformIntegrations>(PLATFORM_INTEGRATIONS_CACHE_KEY, {});
  },

  savePlatformIntegrations: async (p: PlatformIntegrations) => {
    if (!db) throw new Error('Firestore indisponível.');
    const payload: PlatformIntegrations = { ...p, updatedAt: Date.now() };
    await setDoc(systemDoc('ktag_settings_v3', PLATFORM_INTEGRATIONS_DOC), cleanData(payload as any), { merge: true });
    cache.set(PLATFORM_INTEGRATIONS_CACHE_KEY, payload);
  },

  // --- SETTINGS (por tenant agora — D4) ---
  // Faz overlay automático das integrações de plataforma sobre os campos
  // proxy/K-TAG URL/Traqcare token. Assim a app inteira (api.ts, xadtag.ts,
  // hinova.ts) consome valores centralizados sem precisar de mudança.
  getSettings: async (): Promise<AppSettings> => {
    let tenantSettings: AppSettings = {} as AppSettings;
    if (db) {
      try {
        const snap = await getDoc(tenantDoc(COLLECTIONS.SETTINGS, 'config'));
        if (snap.exists()) {
          tenantSettings = snap.data() as AppSettings;
          cache.set(COLLECTIONS.SETTINGS, tenantSettings);
        } else {
          tenantSettings = cache.get<AppSettings>(COLLECTIONS.SETTINGS, {} as AppSettings);
        }
      } catch (e: any) {
        if (e?.code !== 'permission-denied') {
          console.warn('Settings Fetch failed, using local cache.');
        }
        tenantSettings = cache.get<AppSettings>(COLLECTIONS.SETTINGS, {} as AppSettings);
      }
    } else {
      tenantSettings = cache.get<AppSettings>(COLLECTIONS.SETTINGS, {} as AppSettings);
    }

    // Overlay de plataforma: super admin define a URL única do proxy compartilhado.
    // K-TAG URL e Traqcare token permanecem por-tenant (cada empresa configura).
    const platform = await storage.getPlatformIntegrations().catch(() => ({} as PlatformIntegrations));
    return {
      ...tenantSettings,
      customProxyUrl: platform.proxyUrl || tenantSettings.customProxyUrl || '',
    };
  },

  // Subconjunto público (whitelabel/tema) — legível sem auth para pintar
  // Login e splash. Espelhado por saveSettings no doc /public_settings/whitelabel.
  getPublicSettings: async (): Promise<PublicSettings> => {
    if (db) {
      try {
        const snap = await getDoc(tenantDoc(COLLECTIONS.PUBLIC_SETTINGS, PUBLIC_SETTINGS_DOC));
        if (snap.exists()) {
          const data = snap.data() as PublicSettings;
          cache.set(COLLECTIONS.PUBLIC_SETTINGS, data);
          return data;
        }
      } catch {
        // Cache local cobre — silencioso para evitar ruído em tela de login.
      }
    }
    return cache.get<PublicSettings>(COLLECTIONS.PUBLIC_SETTINGS, {} as PublicSettings);
  },

  saveSettings: async (s: AppSettings) => {
    // customProxyUrl vem da plataforma (super admin) — não persiste no doc
    // do tenant para evitar drift. getSettings sempre faz overlay no read.
    const { customProxyUrl: _p, ...tenantOnly } = s as any;
    const persisted = tenantOnly as AppSettings;
    if (db) {
      await setDoc(tenantDoc(COLLECTIONS.SETTINGS, 'config'), cleanData(persisted));
      // Espelha o subconjunto público — Login/WhitelabelStyles leem deste doc
      // sem precisar de auth. Se falhar (sem permissão de escrita no
      // espelho), seguimos — o doc privado já foi salvo.
      try {
        await setDoc(
          tenantDoc(COLLECTIONS.PUBLIC_SETTINGS, PUBLIC_SETTINGS_DOC),
          cleanData(pickPublicSettings(s) as any),
        );
      } catch (e) {
        console.warn('Mirror de public_settings falhou:', e);
      }
    }
    cache.set(COLLECTIONS.SETTINGS, s);
    cache.set(COLLECTIONS.PUBLIC_SETTINGS, pickPublicSettings(s));
  },

  // --- AUDIT LOGS ---
  logAction: async (user: User | null, action: AuditLog['action'], entity: string, details: string, entityId?: string) => {
    let currentUser = user;
    if (!currentUser) {
      currentUser = await storage.getSessionUser();
    }
    if (!currentUser) return;

    await encryption.waitReady();
    const logEntry: AuditLog = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      action,
      entity,
      entityId,
      details: await encryption.encrypt(details),
      timestamp: Date.now()
    };
    if (db) await addDoc(tenantCollection(COLLECTIONS.AUDIT_LOGS), cleanData(logEntry as any));
  },

  getAuditLogs: async (count = 100): Promise<AuditLog[]> => {
    if (!db) return [];
    try {
      const q = query(tenantCollection(COLLECTIONS.AUDIT_LOGS), orderBy('timestamp', 'desc'), limit(count));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => d.data() as AuditLog);
      await encryption.waitReady();
      return Promise.all(data.map(async log => ({
        ...log,
        details: await encryption.decrypt(log.details)
      })));
    } catch (e) {
      return [];
    }
  },

  // --- TECHNICIANS ---
  getTechnicians: async (): Promise<Technician[]> => {
    if (!db) return [];
    const res = await fetchResilient(tenantCollection(COLLECTIONS.TECHNICIANS));
    return res as Technician[];
  },

  saveTechnician: async (tech: Technician) => {
    if (db) await setDoc(tenantDoc(COLLECTIONS.TECHNICIANS, tech.id), cleanData(tech));
  },

  deleteTechnician: async (id: string) => {
    if (db) await deleteDoc(tenantDoc(COLLECTIONS.TECHNICIANS, id));
  },

  // --- SCHEDULES ---
  getSchedules: async (role: string, userId: string): Promise<Schedule[]> => {
    if (!db) return [];
    let q: Query;
    if (role === 'user') {
      q = query(tenantCollection(COLLECTIONS.SCHEDULES), where('requesterId', '==', userId));
    } else if (role === 'technician') {
      q = query(tenantCollection(COLLECTIONS.SCHEDULES), where('technicianId', '==', userId));
    } else {
      q = tenantCollection(COLLECTIONS.SCHEDULES);
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Schedule);
  },

  saveSchedule: async (s: Schedule) => {
    if (db) {
      const isNew = !(await getDoc(tenantDoc(COLLECTIONS.SCHEDULES, s.id))).exists();
      await setDoc(tenantDoc(COLLECTIONS.SCHEDULES, s.id), cleanData(s));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Schedule', `${isNew ? 'Nova solicitação' : 'Atualização'} de agendamento: ${s.vehiclePlate}`, s.id);
    }
  },

  deleteSchedule: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.SCHEDULES, id));
      await storage.logAction(null, 'DELETE', 'Schedule', `Agendamento removido: ${id}`, id);
    }
  },

  subscribeToSchedules: (role: string, userId: string, onUpdate: (schedules: Schedule[]) => void) => {
    if (!db) return () => {};
    let q: Query;
    if (role === 'user') {
      q = query(tenantCollection(COLLECTIONS.SCHEDULES), where('requesterId', '==', userId));
    } else if (role === 'technician') {
      q = query(tenantCollection(COLLECTIONS.SCHEDULES), where('technicianId', '==', userId));
    } else {
      q = tenantCollection(COLLECTIONS.SCHEDULES);
    }
    return onSnapshot(q, (snap) => {
      const schedules = snap.docs.map(d => d.data() as Schedule);
      onUpdate(schedules);
    });
  },

  // --- FEEDBACK ---
  saveFeedback: async (feedback: Feedback) => {
    if (db) {
      await setDoc(tenantDoc(COLLECTIONS.FEEDBACKS, feedback.id), cleanData(feedback));
      await storage.logAction(null, 'CREATE', 'Feedback', `Novo feedback enviado: ${feedback.type}`, feedback.id);
    }
  },

  getFeedbacks: async (): Promise<Feedback[]> => {
    if (!db) return [];
    const q = query(tenantCollection(COLLECTIONS.FEEDBACKS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Feedback);
  },

  // --- SYSTEM UPDATES (por tenant nesta fase; vira global na fase do painel admin) ---
  saveSystemUpdate: async (update: SystemUpdate) => {
    if (db) {
      const isNew = !(await getDoc(tenantDoc(COLLECTIONS.SYSTEM_UPDATES, update.id))).exists();
      await setDoc(tenantDoc(COLLECTIONS.SYSTEM_UPDATES, update.id), cleanData(update));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'SystemUpdate', `${isNew ? 'Nova atualização' : 'Edição'} de sistema: ${update.title}`, update.id);
    }
  },

  getSystemUpdates: async (): Promise<SystemUpdate[]> => {
    if (!db) return [];
    const q = query(tenantCollection(COLLECTIONS.SYSTEM_UPDATES), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as SystemUpdate);
  },

  deleteSystemUpdate: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.SYSTEM_UPDATES, id));
      await storage.logAction(null, 'DELETE', 'SystemUpdate', `Atualização removida: ${id}`, id);
    }
  },

  // --- SHIPMENTS ---
  subscribeShipments: (callback: (shipments: Shipment[]) => void) => {
    if (!db) return () => {};
    const q = query(tenantCollection(COLLECTIONS.SHIPMENTS), orderBy('dataCriacao', 'desc'));
    return onSnapshot(q, async (snap) => {
      const raw = snap.docs.map(d => ({ ...d.data(), id: d.id })) as Shipment[];
      await encryption.waitReady();
      const decrypted = await Promise.all(raw.map(async s => ({
        ...s,
        destinatario: {
          ...s.destinatario,
          nome: await encryption.decrypt(s.destinatario.nome),
          enderecoCompleto: await encryption.decrypt(s.destinatario.enderecoCompleto)
        }
      })));
      callback(decrypted);
    });
  },

  saveShipment: async (s: Shipment) => {
    await encryption.waitReady();
    const encryptedShipment = {
      ...s,
      destinatario: {
        ...s.destinatario,
        nome: await encryption.encrypt(s.destinatario.nome),
        enderecoCompleto: await encryption.encrypt(s.destinatario.enderecoCompleto)
      }
    };
    if (db) {
      const isNew = !(await getDoc(tenantDoc(COLLECTIONS.SHIPMENTS, s.id))).exists();
      await setDoc(tenantDoc(COLLECTIONS.SHIPMENTS, s.id), cleanData(encryptedShipment as any));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Shipment', `${isNew ? 'Nova remessa' : 'Atualização de remessa'}: ${s.titulo}`, s.id);
    }
  },

  updateShipmentStatus: async (id: string, status: Shipment['status'], trackingCode?: string) => {
    if (db) {
      const updates: Partial<Shipment> = { status, updatedAt: Date.now() };
      if (trackingCode !== undefined) updates.codigoRastreio = trackingCode;
      if (status === 'enviado') updates.dataEnvio = Date.now();
      if (status === 'entregue') updates.dataEntrega = Date.now();
      await updateDoc(tenantDoc(COLLECTIONS.SHIPMENTS, id), updates as any);
      await storage.logAction(null, 'UPDATE', 'Shipment', `Status da remessa alterado para ${status}`, id);
    }
  },

  updateShipment: async (id: string, updates: Partial<Shipment>) => {
    if (db) {
      await updateDoc(tenantDoc(COLLECTIONS.SHIPMENTS, id), { ...updates, updatedAt: Date.now() } as any);
      await storage.logAction(null, 'UPDATE', 'Shipment', `Dados da remessa atualizados via sync Melhor Envio`, id);
    }
  },

  deleteShipment: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.SHIPMENTS, id));
      await storage.logAction(null, 'DELETE', 'Shipment', `Remessa removida: ${id}`, id);
    }
  },

  // --- SHIPPING ADDRESSES ---
  subscribeShippingAddresses: (consultorId: string | undefined, callback: (addresses: ShippingAddress[]) => void) => {
    if (!db) return () => {};
    return onSnapshot(tenantCollection(COLLECTIONS.SHIPPING_ADDRESSES), async (snap) => {
      let raw = snap.docs.map(d => ({ ...d.data(), id: d.id })) as ShippingAddress[];
      if (consultorId) {
        raw = raw.filter((a: any) => a.consultorId === consultorId);
      }
      await encryption.waitReady();
      const decrypted = await Promise.all(raw.map(async (a: any) => ({
        ...a,
        enderecoCompleto: await encryption.decrypt(a.enderecoCompleto)
      })));
      callback(decrypted as ShippingAddress[]);
    });
  },

  saveShippingAddress: async (a: ShippingAddress) => {
    await encryption.waitReady();
    const enc: any = {
      ...a,
      enderecoCompleto: await encryption.encrypt((a as any).enderecoCompleto)
    };
    if (db) {
      const isNew = !(await getDoc(tenantDoc(COLLECTIONS.SHIPPING_ADDRESSES, (a as any).id))).exists();
      await setDoc(tenantDoc(COLLECTIONS.SHIPPING_ADDRESSES, (a as any).id), cleanData(enc));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'ShippingAddress', `${isNew ? 'Novo endereço' : 'Atualização de endereço'}: ${(a as any).apelido}`, (a as any).id);
    }
  },

  deleteShippingAddress: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.SHIPPING_ADDRESSES, id));
      await storage.logAction(null, 'DELETE', 'ShippingAddress', `Endereço removido: ${id}`, id);
    }
  },

  // --- TECHNICIAN PAYMENTS ---
  getTechnicianPayments: async (technicianId?: string): Promise<any[]> => {
    if (!db) return [];
    try {
      const base = tenantCollection(COLLECTIONS.TECHNICIAN_PAYMENTS);
      const q: Query = technicianId ? query(base, where('technicianId', '==', technicianId)) : base;
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.error("Error fetching technician payments", e);
      return [];
    }
  },

  saveTechnicianPayment: async (payment: any) => {
    if (db) {
      await setDoc(tenantDoc(COLLECTIONS.TECHNICIAN_PAYMENTS, payment.id), cleanData(payment));
      await storage.logAction(null, 'CREATE', 'TechnicianPayment', `Pagamento registrado: ${payment.id}`, payment.id);
    }
  },

  deleteTechnicianPayment: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.TECHNICIAN_PAYMENTS, id));
      await storage.logAction(null, 'DELETE', 'TechnicianPayment', `Pagamento removido: ${id}`, id);
    }
  },

  // --- CUSTOM ROLES ---
  getCustomRoles: async () => {
    if (!db) return [];
    const snap = await getDocs(tenantCollection(COLLECTIONS.CUSTOM_ROLES));
    return snap.docs.map(d => d.data() as any);
  },

  saveCustomRole: async (role: any) => {
    if (db) {
      await setDoc(tenantDoc(COLLECTIONS.CUSTOM_ROLES, role.id), cleanData(role));
      await storage.logAction(null, 'UPDATE', 'CustomRole', `Cargo salvo: ${role.name}`, role.id);
    }
  },

  deleteCustomRole: async (id: string) => {
    if (db) {
      await deleteDoc(tenantDoc(COLLECTIONS.CUSTOM_ROLES, id));
      await storage.logAction(null, 'DELETE', 'CustomRole', `Cargo deletado: ${id}`, id);
    }
  },

  // --- LOCAL-ONLY ---
  getTheme: () => localStorage.getItem('ktag_theme') || 'light',
  setTheme: (t: string) => localStorage.setItem('ktag_theme', t),
  getNotifications: () => cache.get<AppNotification[]>('notifications', []),
  saveNotifications: (n: AppNotification[]) => cache.set('notifications', n),
};
