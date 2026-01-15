
import { Tag, Vehicle, User, LocationHistory, AppSettings, Company, VehicleCategory, StolenRecord, Client, AuditLog, AppNotification } from '../types';
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, setDoc, writeBatch, getDoc, orderBy, limit } from 'firebase/firestore';
import { encryption } from './encryption';

const KEYS = {
  USER_SESSION: 'ktag_user_session',
  USERS_DB: 'ktag_users_db',
  TAGS: 'ktag_tags',
  VEHICLES: 'ktag_vehicles',
  CLIENTS: 'ktag_clients',
  LOCATIONS: 'ktag_locations',
  THEME: 'ktag_theme',
  SETTINGS: 'ktag_settings_v3',
  COMPANIES: 'ktag_companies',
  CATEGORIES: 'ktag_categories',
  STOLEN_RECORDS: 'ktag_stolen_records',
  AUDIT_LOGS: 'ktag_audit_logs',
  NOTIFICATIONS: 'ktag_notifications',
};

const getLocal = <T>(key: string, def: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : def;
  } catch (e) {
    return def;
  }
};

const setLocal = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
};

const cleanData = <T extends Record<string, any>>(data: T): T => {
  const copy = { ...data };
  Object.keys(copy).forEach(key => {
    if (copy[key] === undefined) {
      delete copy[key];
    }
  });
  return copy;
};

export const storage = {
  // Inicializa o vault de criptografia com base no usuário logado
  initEncryption: async (user: User) => {
    await encryption.initialize(user.id + (user.password || 'ktag-vault'));
  },

  getNotifications: (): AppNotification[] => getLocal<AppNotification[]>(KEYS.NOTIFICATIONS, []),
  saveNotifications: (n: AppNotification[]) => setLocal(KEYS.NOTIFICATIONS, n),

  logAction: async (user: User | null, action: AuditLog['action'], entity: string, details: string, entityId?: string) => {
    if (!user) return;
    const encryptedDetails = await encryption.encrypt(details);
    const logEntry: AuditLog = {
      id: crypto.randomUUID(), userId: user.id, userName: user.name, userEmail: user.email,
      action, entity, entityId, details: encryptedDetails, timestamp: Date.now()
    };
    if (db) try { await addDoc(collection(db, KEYS.AUDIT_LOGS), cleanData(logEntry)); } catch (e) {}
    const logs = getLocal<AuditLog[]>(KEYS.AUDIT_LOGS, []);
    logs.unshift(logEntry);
    if (logs.length > 200) logs.pop();
    setLocal(KEYS.AUDIT_LOGS, logs);
  },

  getSessionUser: async (): Promise<User | null> => {
    const u = getLocal<User | null>(KEYS.USER_SESSION, null);
    if (u) await storage.initEncryption(u);
    return u;
  },
  setSessionUser: async (user: User) => {
    setLocal(KEYS.USER_SESSION, user);
    await storage.initEncryption(user);
  },
  clearSessionUser: async () => localStorage.removeItem(KEYS.USER_SESSION),

  findUserByEmail: async (email: string): Promise<User | null> => {
    let userData: User | null = null;
    if (db) {
      try {
        const q = query(collection(db, KEYS.USERS_DB), where("email", "==", email.toLowerCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) userData = { ...snap.docs[0].data(), id: snap.docs[0].id } as User;
      } catch (e) {}
    }
    if (!userData) {
      userData = getLocal<User[]>(KEYS.USERS_DB, []).find(u => u.email === email.toLowerCase().trim()) || null;
    }
    if (userData) {
      return {
        ...userData,
        name: await encryption.decrypt(userData.name),
        cpf: userData.cpf ? await encryption.decrypt(userData.cpf) : undefined
      };
    }
    return null;
  },

  getAllUsers: async (): Promise<User[]> => {
    let data: User[] = [];
    if (db) {
      try {
        const snap = await getDocs(collection(db, KEYS.USERS_DB));
        data = snap.docs.map(d => ({ ...d.data(), id: d.id } as User));
        setLocal(KEYS.USERS_DB, data);
      } catch (e) {}
    } else {
      data = getLocal<User[]>(KEYS.USERS_DB, []);
    }
    return await Promise.all(data.map(async u => ({
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
    if (db) try { await setDoc(doc(db, KEYS.USERS_DB, user.id), cleanData(encryptedUser)); } catch (e) {}
    const users = getLocal<User[]>(KEYS.USERS_DB, []);
    const idx = users.findIndex(u => u.email === user.email);
    if (idx >= 0) users[idx] = encryptedUser; else users.push(encryptedUser);
    setLocal(KEYS.USERS_DB, users);
  },

  getCompanies: async () => {
    if (db) try { 
      const snap = await getDocs(collection(db, KEYS.COMPANIES));
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Company));
      setLocal(KEYS.COMPANIES, data); return data;
    } catch (e) {}
    return getLocal<Company[]>(KEYS.COMPANIES, []);
  },
  saveCompany: async (c: Company) => {
    if (db) try { await setDoc(doc(db, KEYS.COMPANIES, c.id), cleanData(c)); } catch (e) {}
    const list = getLocal<Company[]>(KEYS.COMPANIES, []);
    const idx = list.findIndex(item => item.id === c.id);
    if (idx >= 0) list[idx] = c; else list.push(c);
    setLocal(KEYS.COMPANIES, list);
  },
  deleteCompany: async (id: string) => { 
    if (db) try { await deleteDoc(doc(db, KEYS.COMPANIES, id)); } catch (e) {}
    const list = getLocal<Company[]>(KEYS.COMPANIES, []);
    setLocal(KEYS.COMPANIES, list.filter(c => c.id !== id));
  },

  getClients: async (): Promise<Client[]> => {
    let data: Client[] = [];
    if (db) try {
      const snap = await getDocs(collection(db, KEYS.CLIENTS));
      data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
    } catch (e) {
      data = getLocal<Client[]>(KEYS.CLIENTS, []);
    }
    return await Promise.all(data.map(async c => ({
      ...c,
      name: await encryption.decrypt(c.name),
      cpf: await encryption.decrypt(c.cpf),
      phone: await encryption.decrypt(c.phone),
      email: c.email ? await encryption.decrypt(c.email) : undefined,
      address: c.address ? await encryption.decrypt(c.address) : undefined,
      city: c.city ? await encryption.decrypt(c.city) : undefined,
      state: c.state ? await encryption.decrypt(c.state) : undefined
    })));
  },
  saveClient: async (c: Client) => {
    const encryptedClient = {
      ...c,
      name: await encryption.encrypt(c.name),
      cpf: await encryption.encrypt(c.cpf),
      phone: await encryption.encrypt(c.phone),
      email: c.email ? await encryption.encrypt(c.email) : undefined,
      address: c.address ? await encryption.encrypt(c.address) : undefined,
      city: c.city ? await encryption.encrypt(c.city) : undefined,
      state: c.state ? await encryption.encrypt(c.state) : undefined
    };
    if (db) try { await setDoc(doc(db, KEYS.CLIENTS, c.id), cleanData(encryptedClient)); } catch (e) {}
    const list = getLocal<Client[]>(KEYS.CLIENTS, []);
    const idx = list.findIndex(item => item.id === c.id);
    if (idx >= 0) list[idx] = encryptedClient; else list.push(encryptedClient);
    setLocal(KEYS.CLIENTS, list);
  },

  getTags: async (): Promise<Tag[]> => {
    let data: Tag[] = [];
    if (db) try {
      const snap = await getDocs(collection(db, KEYS.TAGS));
      data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Tag));
    } catch (e) {
      data = getLocal<Tag[]>(KEYS.TAGS, []);
    }
    return await Promise.all(data.map(async t => ({
      ...t,
      hashedAdvKey: t.hashedAdvKey ? await encryption.decrypt(t.hashedAdvKey) : undefined,
      privateKey: t.privateKey ? await encryption.decrypt(t.privateKey) : undefined,
      imei: t.imei ? await encryption.decrypt(t.imei) : undefined
    })));
  },
  saveTag: async (t: Tag) => {
    const encryptedTag = {
      ...t,
      hashedAdvKey: t.hashedAdvKey ? await encryption.encrypt(t.hashedAdvKey) : undefined,
      privateKey: t.privateKey ? await encryption.encrypt(t.privateKey) : undefined,
      imei: t.imei ? await encryption.encrypt(t.imei) : undefined
    };
    if (db) try { await setDoc(doc(db, KEYS.TAGS, t.id), cleanData(encryptedTag)); } catch (e) {}
    const tags = getLocal<Tag[]>(KEYS.TAGS, []);
    const idx = tags.findIndex(item => item.id === t.id);
    if (idx >= 0) tags[idx] = encryptedTag; else tags.push(encryptedTag);
    setLocal(KEYS.TAGS, tags);
  },

  getVehicles: async () => {
    let data: Vehicle[] = [];
    if (db) try {
      const snap = await getDocs(collection(db, KEYS.VEHICLES));
      data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle));
      setLocal(KEYS.VEHICLES, data);
    } catch (e) {
      data = getLocal<Vehicle[]>(KEYS.VEHICLES, []);
    }
    return await Promise.all(data.map(async v => ({
      ...v,
      plate: await encryption.decrypt(v.plate)
    })));
  },
  saveVehicle: async (v: Vehicle) => {
    const encryptedVehicle = {
      ...v,
      plate: await encryption.encrypt(v.plate)
    };
    if (db) try { await setDoc(doc(db, KEYS.VEHICLES, v.id), cleanData(encryptedVehicle)); } catch (e) {}
    const list = getLocal<Vehicle[]>(KEYS.VEHICLES, []);
    const idx = list.findIndex(item => item.id === v.id);
    if (idx >= 0) list[idx] = encryptedVehicle; else list.push(encryptedVehicle);
    setLocal(KEYS.VEHICLES, list);
  },

  getSettings: async (): Promise<AppSettings> => {
    if (db) try {
      const snap = await getDoc(doc(db, KEYS.SETTINGS, 'config'));
      if (snap.exists()) return snap.data() as AppSettings;
    } catch (e) {}
    return getLocal<AppSettings>(KEYS.SETTINGS, {} as any);
  },
  saveSettings: async (s: AppSettings) => {
    if (db) try { await setDoc(doc(db, KEYS.SETTINGS, 'config'), cleanData(s)); } catch (e) {}
    setLocal(KEYS.SETTINGS, s);
  },
  
  deleteTag: async (id: string) => { if (db) await deleteDoc(doc(db, KEYS.TAGS, id)); },
  deleteVehicle: async (id: string) => { if (db) await deleteDoc(doc(db, KEYS.VEHICLES, id)); },
  deleteClient: async (id: string) => { if (db) await deleteDoc(doc(db, KEYS.CLIENTS, id)); },

  getAuditLogs: async (count = 100) => {
    let data: AuditLog[] = [];
    if (db) {
       const q = query(collection(db, KEYS.AUDIT_LOGS), orderBy('timestamp', 'desc'), limit(count));
       const snap = await getDocs(q);
       data = snap.docs.map(d => d.data() as AuditLog);
    } else {
       data = getLocal<AuditLog[]>(KEYS.AUDIT_LOGS, []);
    }
    return await Promise.all(data.map(async log => ({
      ...log,
      details: await encryption.decrypt(log.details)
    })));
  },

  getStolenRecords: async () => {
    let data: StolenRecord[] = [];
    if (db) {
       const q = query(collection(db, KEYS.STOLEN_RECORDS), orderBy('timestamp', 'desc'));
       const snap = await getDocs(q);
       data = snap.docs.map(d => d.data() as StolenRecord);
    } else {
       data = getLocal<StolenRecord[]>(KEYS.STOLEN_RECORDS, []);
    }
    return await Promise.all(data.map(async r => ({
      ...r,
      vehiclePlate: await encryption.decrypt(r.vehiclePlate)
    })));
  },

  reportTheft: async (r: StolenRecord) => {
    const encryptedRecord = {
      ...r,
      vehiclePlate: await encryption.encrypt(r.vehiclePlate)
    };
    if (db) await setDoc(doc(db, KEYS.STOLEN_RECORDS, r.id), cleanData(encryptedRecord));
    const v = (await storage.getVehicles()).find(item => item.id === r.vehicleId);
    if (v) await storage.saveVehicle({ ...v, status: 'stolen' });
  },

  getCategories: async () => {
    if (db) try { 
      const snap = await getDocs(collection(db, KEYS.CATEGORIES));
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as VehicleCategory));
      setLocal(KEYS.CATEGORIES, data); return data;
    } catch (e) {}
    return getLocal<VehicleCategory[]>(KEYS.CATEGORIES, []);
  },
  saveCategory: async (c: VehicleCategory) => {
    if (db) try { await setDoc(doc(db, KEYS.CATEGORIES, c.id), cleanData(c)); } catch (e) {}
    const list = getLocal<VehicleCategory[]>(KEYS.CATEGORIES, []);
    const idx = list.findIndex(item => item.id === c.id);
    if (idx >= 0) list[idx] = c; else list.push(c);
    setLocal(KEYS.CATEGORIES, list);
  },
  deleteCategory: async (id: string) => { 
    if (db) try { await deleteDoc(doc(db, KEYS.CATEGORIES, id)); } catch (e) {}
    const list = getLocal<VehicleCategory[]>(KEYS.CATEGORIES, []);
    setLocal(KEYS.CATEGORIES, list.filter(c => c.id !== id));
  },

  updateUserProfile: async (id: string, d: Partial<User>) => {
    const updateData: any = { ...d };
    if (d.name) updateData.name = await encryption.encrypt(d.name);
    if (d.cpf) updateData.cpf = await encryption.encrypt(d.cpf);
    if (db) await updateDoc(doc(db, KEYS.USERS_DB, id), cleanData(updateData));
  },

  updateUserStatus: async (id: string, s: string) => {
    if (db) await updateDoc(doc(db, KEYS.USERS_DB, id), { status: s });
  },

  getLocations: async (id: string) => [], 
  getTheme: () => localStorage.getItem(KEYS.THEME) as any || 'light',
  setTheme: (t: string) => localStorage.setItem(KEYS.THEME, t),
};
