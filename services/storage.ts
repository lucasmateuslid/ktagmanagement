
// ... keep imports ...
import { Tag, Vehicle, User, LocationHistory, AppSettings, Company, VehicleCategory, StolenRecord, Client, AuditLog, AppNotification, Schedule, Technician, ScheduleHistory } from '../types';
import { db } from './firebase';
import { 
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, 
  query, where, setDoc, getDoc, orderBy, limit, getDocsFromCache, onSnapshot 
} from 'firebase/firestore';
import { encryption } from './encryption';
import { jwtService } from './jwt';
import { securityService } from './security';

const KEYS = {
  USER_SESSION: 'ktag_auth_token', 
  USERS_DB: 'ktag_users_db',
  TAGS: 'ktag_tags',
  VEHICLES: 'ktag_vehicles',
  CLIENTS: 'ktag_clients',
  SETTINGS: 'ktag_settings_v3',
  COMPANIES: 'ktag_companies',
  CATEGORIES: 'ktag_categories',
  STOLEN_RECORDS: 'ktag_stolen_records',
  AUDIT_LOGS: 'ktag_audit_logs',
  NOTIFICATIONS: 'ktag_notifications',
  SCHEDULES: 'ktag_schedules',
  TECHNICIANS: 'ktag_technicians',
};

// ... keep cache and cleanData ...
const cache = {
  get: <T>(key: string, def: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : def;
    } catch (e) { return def; }
  },
  set: (key: string, value: any) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
};

const cleanData = <T extends Record<string, any>>(data: T): T => {
  const copy = { ...data };
  Object.keys(copy).forEach(key => {
    if (copy[key] === undefined || copy[key] === null) delete copy[key];
  });
  return copy;
};

// Helper para buscar dados de forma resiliente
const fetchResilient = async (colName: string) => {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, colName));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.warn(`Firestore Fetch failed for ${colName}, attempting cache...`);
    try {
      const snap = await getDocsFromCache(collection(db, colName));
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    } catch (cacheErr) {
      return [];
    }
  }
};

export const storage = {
  // ... existing methods (initEncryption, sessions, users, vehicles, clients, tags, companies, categories, stolen, settings, audit) ...
  
  // --- SEGURANÇA E SESSÃO (JWT UPDATED) ---
  initEncryption: async (user: User) => {
    const scope = user.companySlug || 'default-global-scope';
    const seed = `ktag-enterprise-master-key-${scope}-v2`; 
    await encryption.initialize(seed);
  },

  getSessionUser: async (): Promise<User | null> => {
    const token = localStorage.getItem(KEYS.USER_SESSION);
    if (!token) return null;

    const user = await jwtService.verify(token);
    
    if (user) {
      await storage.initEncryption(user);
      return user;
    } else {
      await storage.clearSessionUser();
      return null;
    }
  },

  setSessionUser: async (user: User) => {
    const token = await jwtService.sign(user);
    localStorage.setItem(KEYS.USER_SESSION, token);
    await storage.initEncryption(user);
  },

  clearSessionUser: async () => {
    localStorage.removeItem(KEYS.USER_SESSION);
    const keysToKeep = [KEYS.SETTINGS, 'ktag_theme'];
    Object.keys(localStorage).forEach(k => {
      if (!keysToKeep.includes(k)) localStorage.removeItem(k);
    });
  },

  // --- GESTÃO DE USUÁRIOS ---
  findUserByEmail: async (email: string, decrypt = true): Promise<User | null> => {
    const cleanEmail = email.toLowerCase().trim();
    if (db) {
      try {
        const q = query(collection(db, KEYS.USERS_DB), where("email", "==", cleanEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const userData = { ...snap.docs[0].data(), id: snap.docs[0].id } as User;
          if (decrypt) {
             return {
                ...userData,
                name: await encryption.decrypt(userData.name),
                cpf: userData.cpf ? await encryption.decrypt(userData.cpf) : undefined
             };
          }
          return userData;
        }
      } catch (e) { console.error("DB User Lookup Error", e); }
    }
    return null;
  },

  getAllUsers: async (): Promise<User[]> => {
    const data = await fetchResilient(KEYS.USERS_DB) as User[];
    return Promise.all(data.map(async u => ({
      ...u,
      name: await encryption.decrypt(u.name),
      cpf: u.cpf ? await encryption.decrypt(u.cpf) : undefined
    })));
  },

  registerUserRequest: async (user: User) => {
    const encryptedUser = {
      ...user,
      name: await encryption.encrypt(user.name),
      cpf: user.cpf ? await encryption.encrypt(user.cpf) : undefined
    };
    if (db) await setDoc(doc(db, KEYS.USERS_DB, user.id), cleanData(encryptedUser));
  },

  updateUserProfile: async (id: string, data: Partial<User>) => {
    if (db) {
      const userRef = doc(db, KEYS.USERS_DB, id);
      const encryptedData = { ...data };
      if (data.name) encryptedData.name = await encryption.encrypt(data.name);
      if (data.cpf) encryptedData.cpf = await encryption.encrypt(data.cpf);
      await updateDoc(userRef, cleanData(encryptedData));
    }
  },

  updateUserStatus: async (id: string, status: User['status']) => {
    if (db) {
      const userRef = doc(db, KEYS.USERS_DB, id);
      await updateDoc(userRef, { status });
    }
  },

  // --- GESTÃO DE VEÍCULOS E CLIENTES (E2EE PROTECTED) ---
  getVehicles: async (): Promise<Vehicle[]> => {
    const raw = await fetchResilient(KEYS.VEHICLES) as Vehicle[];
    if (raw.length > 0) cache.set(KEYS.VEHICLES, raw);
    
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
      plateHash: await securityService.generateSearchIndex(v.plate) // Blind Index
    };
    
    if (db) await setDoc(doc(db, KEYS.VEHICLES, v.id), cleanData(encryptedVehicle));
    
    const list = cache.get<Vehicle[]>(KEYS.VEHICLES, []);
    const idx = list.findIndex(item => item.id === v.id);
    if (idx >= 0) list[idx] = encryptedVehicle; else list.push(encryptedVehicle);
    cache.set(KEYS.VEHICLES, list);
  },

  getClients: async (): Promise<Client[]> => {
    const raw = await fetchResilient(KEYS.CLIENTS) as Client[];
    if (raw.length > 0) cache.set(KEYS.CLIENTS, raw);

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
      cpfHash: await securityService.generateSearchIndex(c.cpf) // Blind Index
    };
    
    if (db) await setDoc(doc(db, KEYS.CLIENTS, c.id), cleanData(encryptedClient));
    const list = cache.get<Client[]>(KEYS.CLIENTS, []);
    const idx = list.findIndex(item => item.id === c.id);
    if (idx >= 0) list[idx] = encryptedClient; else list.push(encryptedClient);
    cache.set(KEYS.CLIENTS, list);
  },

  // --- GESTÃO DE EQUIPAMENTOS (ESTOQUE) ---
  getTags: async (): Promise<Tag[]> => {
    const raw = await fetchResilient(KEYS.TAGS) as Tag[];
    if (raw.length > 0) cache.set(KEYS.TAGS, raw);

    await encryption.waitReady();
    return Promise.all(raw.map(async t => ({
      ...t,
      hashedAdvKey: t.hashedAdvKey ? await encryption.decrypt(t.hashedAdvKey) : undefined,
      privateKey: t.privateKey ? await encryption.decrypt(t.privateKey) : undefined,
      imei: t.imei ? await encryption.decrypt(t.imei) : undefined
    })));
  },

  saveTag: async (t: Tag) => {
    await encryption.waitReady();
    const encryptedTag = {
      ...t,
      hashedAdvKey: t.hashedAdvKey ? await encryption.encrypt(t.hashedAdvKey) : undefined,
      privateKey: t.privateKey ? await encryption.encrypt(t.privateKey) : undefined,
      imei: t.imei ? await encryption.encrypt(t.imei) : undefined
    };
    if (db) await setDoc(doc(db, KEYS.TAGS, t.id), cleanData(encryptedTag));
    const tags = cache.get<Tag[]>(KEYS.TAGS, []);
    const idx = tags.findIndex(item => item.id === t.id);
    if (idx >= 0) tags[idx] = encryptedTag; else tags.push(encryptedTag);
    cache.set(KEYS.TAGS, tags);
  },

  // --- GESTÃO DE EMPRESAS E CATEGORIAS ---
  getCompanies: async (): Promise<Company[]> => {
    const data = await fetchResilient(KEYS.COMPANIES) as Company[];
    if (data.length > 0) cache.set(KEYS.COMPANIES, data);
    return data;
  },

  saveCompany: async (c: Company) => {
    if (db) await setDoc(doc(db, KEYS.COMPANIES, c.id), cleanData(c));
    const list = cache.get<Company[]>(KEYS.COMPANIES, []);
    const idx = list.findIndex(item => item.id === c.id);
    if (idx >= 0) list[idx] = c; else list.push(c);
    cache.set(KEYS.COMPANIES, list);
  },

  deleteCompany: async (id: string) => {
    if (db) await deleteDoc(doc(db, KEYS.COMPANIES, id));
    const list = cache.get<Company[]>(KEYS.COMPANIES, []);
    cache.set(KEYS.COMPANIES, list.filter(c => c.id !== id));
  },

  getCategories: async (): Promise<VehicleCategory[]> => {
    const data = await fetchResilient(KEYS.CATEGORIES) as VehicleCategory[];
    if (data.length > 0) cache.set(KEYS.CATEGORIES, data);
    return data;
  },

  saveCategory: async (cat: VehicleCategory) => {
    if (db) await setDoc(doc(db, KEYS.CATEGORIES, cat.id), cleanData(cat));
    const list = cache.get<VehicleCategory[]>(KEYS.CATEGORIES, []);
    const idx = list.findIndex(item => item.id === cat.id);
    if (idx >= 0) list[idx] = cat; else list.push(cat);
    cache.set(KEYS.CATEGORIES, list);
  },

  deleteCategory: async (id: string) => {
    if (db) await deleteDoc(doc(db, KEYS.CATEGORIES, id));
    const list = cache.get<VehicleCategory[]>(KEYS.CATEGORIES, []);
    cache.set(KEYS.CATEGORIES, list.filter(c => c.id !== id));
  },

  // --- GESTÃO DE OCORRÊNCIAS (ROUBO) ---
  getStolenRecords: async (): Promise<StolenRecord[]> => {
    const data = await fetchResilient(KEYS.STOLEN_RECORDS) as StolenRecord[];
    if (data.length > 0) cache.set(KEYS.STOLEN_RECORDS, data);
    return data;
  },

  reportTheft: async (record: StolenRecord) => {
    if (db) {
      await setDoc(doc(db, KEYS.STOLEN_RECORDS, record.id), cleanData(record));
      const vehicleRef = doc(db, KEYS.VEHICLES, record.vehicleId);
      await updateDoc(vehicleRef, { status: 'stolen' });
    }
    const list = cache.get<StolenRecord[]>(KEYS.STOLEN_RECORDS, []);
    list.push(record);
    cache.set(KEYS.STOLEN_RECORDS, list);
  },

  getLocations: async (tagId: string): Promise<LocationHistory[]> => {
    return []; 
  },

  // --- CONFIGURAÇÕES E AUDITORIA ---
  getSettings: async (): Promise<AppSettings> => {
    if (db) {
      try {
        const snap = await getDoc(doc(db, KEYS.SETTINGS, 'config'));
        if (snap.exists()) {
          const data = snap.data() as AppSettings;
          cache.set(KEYS.SETTINGS, data);
          return data;
        }
      } catch (e) {
        console.warn("Settings Fetch failed, using local cache.");
      }
    }
    return cache.get<AppSettings>(KEYS.SETTINGS, {} as any);
  },

  saveSettings: async (s: AppSettings) => {
    if (db) await setDoc(doc(db, KEYS.SETTINGS, 'config'), cleanData(s));
    cache.set(KEYS.SETTINGS, s);
  },

  logAction: async (user: User | null, action: AuditLog['action'], entity: string, details: string, entityId?: string) => {
    if (!user) return;
    await encryption.waitReady();
    const logEntry: AuditLog = {
      id: crypto.randomUUID(), userId: user.id, userName: user.name, userEmail: user.email,
      action, entity, entityId, details: await encryption.encrypt(details), timestamp: Date.now()
    };
    if (db) await addDoc(collection(db, KEYS.AUDIT_LOGS), cleanData(logEntry));
  },

  getAuditLogs: async (count = 100): Promise<AuditLog[]> => {
    if (!db) return [];
    try {
      const q = query(collection(db, KEYS.AUDIT_LOGS), orderBy('timestamp', 'desc'), limit(count));
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

  // --- AGENDAMENTOS E TÉCNICOS (NOVO) ---
  
  // Técnicos
  getTechnicians: async (): Promise<Technician[]> => {
    if (!db) return [];
    const res = await fetchResilient(KEYS.TECHNICIANS);
    return res as Technician[];
  },

  saveTechnician: async (tech: Technician) => {
    if (db) await setDoc(doc(db, KEYS.TECHNICIANS, tech.id), cleanData(tech));
  },

  // Agendamentos (Legacy One-Time Fetch)
  getSchedules: async (role: string, userId: string): Promise<Schedule[]> => {
    if (!db) return [];
    let q;
    if (role === 'user') {
      q = query(collection(db, KEYS.SCHEDULES), where('requesterId', '==', userId));
    } else {
      q = query(collection(db, KEYS.SCHEDULES)); // Admin/Mod vê tudo
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Schedule);
  },

  saveSchedule: async (s: Schedule) => {
    if (db) await setDoc(doc(db, KEYS.SCHEDULES, s.id), cleanData(s));
  },

  deleteSchedule: async (id: string) => {
    if (db) await deleteDoc(doc(db, KEYS.SCHEDULES, id));
  },

  // Realtime Listener para Agendamentos (Principal)
  // Agora suporta Role para filtrar corretamente
  subscribeToSchedules: (role: string, userId: string, onUpdate: (schedules: Schedule[]) => void) => {
    if (!db) return () => {};
    
    let q;
    if (role === 'user') {
      // Usuário vê apenas os dele
      q = query(collection(db, KEYS.SCHEDULES), where('requesterId', '==', userId));
    } else {
      // Admin/Moderator vê tudo
      q = query(collection(db, KEYS.SCHEDULES));
    }

    return onSnapshot(q, (snap) => {
        const schedules = snap.docs.map(d => d.data() as Schedule);
        onUpdate(schedules);
    });
  },

  deleteTag: async (id: string) => { if (db) await deleteDoc(doc(db, KEYS.TAGS, id)); },
  deleteVehicle: async (id: string) => { if (db) await deleteDoc(doc(db, KEYS.VEHICLES, id)); },
  deleteClient: async (id: string) => { if (db) await deleteDoc(doc(db, KEYS.CLIENTS, id)); },
  deleteUser: async (id: string) => { if (db) await deleteDoc(doc(db, KEYS.USERS_DB, id)); },
  
  getTheme: () => localStorage.getItem('ktag_theme') || 'light',
  setTheme: (t: string) => localStorage.setItem('ktag_theme', t),
  getNotifications: () => cache.get<AppNotification[]>(KEYS.NOTIFICATIONS, []),
  saveNotifications: (n: AppNotification[]) => cache.set(KEYS.NOTIFICATIONS, n),
};
