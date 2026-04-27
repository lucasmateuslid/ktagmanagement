
// ... keep imports ...
import { Tag, Vehicle, User, LocationHistory, AppSettings, Company, VehicleCategory, StolenRecord, Client, AuditLog, AppNotification, Schedule, Technician, ScheduleHistory, Feedback, SystemUpdate, Shipment, ShippingAddress } from '../types';
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
  TRACKERS: 'ktag_trackers',
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
  FEEDBACKS: 'ktag_feedbacks',
  SYSTEM_UPDATES: 'ktag_system_updates',
  SHIPMENTS: 'ktag_shipments',
  SHIPPING_ADDRESSES: 'ktag_shipping_addresses',
  TECHNICIAN_PAYMENTS: 'ktag_technician_payments',
  CUSTOM_ROLES: 'ktag_custom_roles',
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
  // ... existing methods ...
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
    await storage.logAction(null, 'CREATE', 'User', `Solicitação de cadastro: ${user.name} (${user.email})`, user.id);
  },

  updateUserProfile: async (id: string, data: Partial<User>) => {
    if (db) {
      const userRef = doc(db, KEYS.USERS_DB, id);
      const encryptedData = { ...data };
      if (data.name) encryptedData.name = await encryption.encrypt(data.name);
      if (data.cpf) encryptedData.cpf = await encryption.encrypt(data.cpf);
      await updateDoc(userRef, cleanData(encryptedData));
      await storage.logAction(null, 'UPDATE', 'User', `Perfil atualizado: ${id}`, id);
    }
  },

  updateUserStatus: async (id: string, status: User['status']) => {
    if (db) {
      const userRef = doc(db, KEYS.USERS_DB, id);
      await updateDoc(userRef, { status });
      await storage.logAction(null, 'UPDATE', 'User', `Status alterado para ${status}`, id);
    }
  },

  // ... Vehicle & Client methods ...
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
    const isNew = idx < 0;
    if (idx >= 0) list[idx] = encryptedVehicle; else list.push(encryptedVehicle);
    cache.set(KEYS.VEHICLES, list);

    await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Vehicle', `${isNew ? 'Cadastro' : 'Atualização'} de veículo: ${v.plate}`, v.id);
  },

  // Novo método para atualização leve de posição
  updateVehiclePosition: async (vehicleId: string, location: LocationHistory) => {
    if (!db) return;
    try {
        const vehicleRef = doc(db, KEYS.VEHICLES, vehicleId);
        await updateDoc(vehicleRef, { lastPosition: location });
    } catch (e) {
        console.warn("Falha ao persistir localização (offline ou erro):", e);
    }
  },

  subscribeVehicles: (callback: (vehicles: Vehicle[]) => void) => {
    if (!db) return () => {};
    return onSnapshot(collection(db, KEYS.VEHICLES), async (snap) => {
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
    const isNew = idx < 0;
    if (idx >= 0) list[idx] = encryptedClient; else list.push(encryptedClient);
    cache.set(KEYS.CLIENTS, list);

    await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Client', `${isNew ? 'Cadastro' : 'Atualização'} de cliente: ${c.name}`, c.id);
  },

  // ... Tags, Companies, Categories methods ...
  getTags: async (): Promise<Tag[]> => {
    const raw = await fetchResilient(KEYS.TAGS) as Tag[];
    if (raw.length > 0) cache.set(KEYS.TAGS, raw);

    await encryption.waitReady();
    return Promise.all(raw.map(async t => {
      let imei = t.imei;
      // Tentativa de descriptografar caso ainda esteja criptografado no banco
      if (imei && imei.length > 30) {
        try {
          imei = await encryption.decrypt(imei);
        } catch (e) {
          // Se falhar, assume que não estava criptografado
        }
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
    return onSnapshot(collection(db, KEYS.TAGS), async (snap) => {
      const raw = snap.docs.map(d => ({ ...d.data(), id: d.id })) as Tag[];
      await encryption.waitReady();
      const decrypted = await Promise.all(raw.map(async t => {
        let imei = t.imei;
        if (imei && imei.length > 30) {
          try { imei = await encryption.decrypt(imei); } catch (e) {}
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
      // IMEI não é mais criptografado conforme solicitado
      imei: t.imei,
      hashedAdvKey: t.hashedAdvKey ? await encryption.encrypt(t.hashedAdvKey) : undefined,
      privateKey: t.privateKey ? await encryption.encrypt(t.privateKey) : undefined
    };
    if (db) await setDoc(doc(db, KEYS.TAGS, t.id), cleanData(encryptedTag));
    const tags = cache.get<Tag[]>(KEYS.TAGS, []);
    const idx = tags.findIndex(item => item.id === t.id);
    const isNew = idx < 0;
    if (idx >= 0) tags[idx] = encryptedTag; else tags.push(encryptedTag);
    cache.set(KEYS.TAGS, tags);

    await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Tag', `${isNew ? 'Cadastro' : 'Atualização'} de tag: ${t.id}`, t.id);
  },

  getCompanies: async (): Promise<Company[]> => {
    const data = await fetchResilient(KEYS.COMPANIES) as Company[];
    if (data.length > 0) cache.set(KEYS.COMPANIES, data);
    return data;
  },

  saveCompany: async (c: Company) => {
    if (db) {
      const isNew = !(await getDoc(doc(db, KEYS.COMPANIES, c.id))).exists();
      await setDoc(doc(db, KEYS.COMPANIES, c.id), cleanData(c));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Company', `${isNew ? 'Cadastro' : 'Atualização'} de regional: ${c.name}`, c.id);
    }
    const list = cache.get<Company[]>(KEYS.COMPANIES, []);
    const idx = list.findIndex(item => item.id === c.id);
    if (idx >= 0) list[idx] = c; else list.push(c);
    cache.set(KEYS.COMPANIES, list);
  },

  deleteCompany: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, KEYS.COMPANIES, id));
      await storage.logAction(null, 'DELETE', 'Company', `Regional removida: ${id}`, id);
    }
    const list = cache.get<Company[]>(KEYS.COMPANIES, []);
    cache.set(KEYS.COMPANIES, list.filter(c => c.id !== id));
  },

  getCategories: async (): Promise<VehicleCategory[]> => {
    const data = await fetchResilient(KEYS.CATEGORIES) as VehicleCategory[];
    if (data.length > 0) cache.set(KEYS.CATEGORIES, data);
    return data;
  },

  saveCategory: async (cat: VehicleCategory) => {
    if (db) {
      const isNew = !(await getDoc(doc(db, KEYS.CATEGORIES, cat.id))).exists();
      await setDoc(doc(db, KEYS.CATEGORIES, cat.id), cleanData(cat));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Category', `${isNew ? 'Cadastro' : 'Atualização'} de categoria: ${cat.name}`, cat.id);
    }
    const list = cache.get<VehicleCategory[]>(KEYS.CATEGORIES, []);
    const idx = list.findIndex(item => item.id === cat.id);
    if (idx >= 0) list[idx] = cat; else list.push(cat);
    cache.set(KEYS.CATEGORIES, list);
  },

  deleteCategory: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, KEYS.CATEGORIES, id));
      await storage.logAction(null, 'DELETE', 'Category', `Categoria removida: ${id}`, id);
    }
    const list = cache.get<VehicleCategory[]>(KEYS.CATEGORIES, []);
    cache.set(KEYS.CATEGORIES, list.filter(c => c.id !== id));
  },

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

  recoverTheft: async (recordId: string, recoveredValue: number) => {
    if (db) {
      const recordRef = doc(db, KEYS.STOLEN_RECORDS, recordId);
      const recordSnap = await getDoc(recordRef);
      if (recordSnap.exists()) {
        const record = recordSnap.data() as StolenRecord;
        await updateDoc(recordRef, { 
          status: 'recovered', 
          recoveredAt: Date.now(),
          recoveredValue 
        });
        const vehicleRef = doc(db, KEYS.VEHICLES, record.vehicleId);
        await updateDoc(vehicleRef, { status: 'active' });
      }
    }
    const list = cache.get<StolenRecord[]>(KEYS.STOLEN_RECORDS, []);
    const idx = list.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      list[idx].status = 'recovered';
      list[idx].recoveredAt = Date.now();
      list[idx].recoveredValue = recoveredValue;
      cache.set(KEYS.STOLEN_RECORDS, list);
    }
  },

  getStolenRecordByToken: async (token: string): Promise<StolenRecord | null> => {
    if (!db) return null;
    const q = query(collection(db, KEYS.STOLEN_RECORDS), where("trackingToken", "==", token), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { ...snap.docs[0].data(), id: snap.docs[0].id } as StolenRecord;
  },

  markAsLost: async (recordId: string, vehicleId: string) => {
    if (db) {
      const recordRef = doc(db, KEYS.STOLEN_RECORDS, recordId);
      const vehicleRef = doc(db, KEYS.VEHICLES, vehicleId);
      
      await updateDoc(recordRef, { 
        status: 'lost',
        lostAt: Date.now()
      });
      
      await updateDoc(vehicleRef, { 
        status: 'inactive' // Ou outro status que indique perda total
      });
    }
  },

  getPublicVehicleLocation: async (vehicleId: string): Promise<LocationHistory | null> => {
    if (!db) return null;
    const vehicleRef = doc(db, KEYS.VEHICLES, vehicleId);
    const snap = await getDoc(vehicleRef);
    if (snap.exists()) {
      const data = snap.data() as Vehicle;
      return data.lastPosition || null;
    }
    return null;
  },

  getLocations: async (tagId: string): Promise<LocationHistory[]> => {
    return []; 
  },

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

  // ... Schedule & Tech methods ...
  getTechnicians: async (): Promise<Technician[]> => {
    if (!db) return [];
    const res = await fetchResilient(KEYS.TECHNICIANS);
    return res as Technician[];
  },

  saveTechnician: async (tech: Technician) => {
    if (db) await setDoc(doc(db, KEYS.TECHNICIANS, tech.id), cleanData(tech));
  },

  deleteTechnician: async (id: string) => {
    if (db) await deleteDoc(doc(db, KEYS.TECHNICIANS, id));
  },

  getSchedules: async (role: string, userId: string): Promise<Schedule[]> => {
    if (!db) return [];
    let q;
    if (role === 'user') {
      q = query(collection(db, KEYS.SCHEDULES), where('requesterId', '==', userId));
    } else if (role === 'technician') {
      q = query(collection(db, KEYS.SCHEDULES), where('technicianId', '==', userId));
    } else {
      q = query(collection(db, KEYS.SCHEDULES)); 
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Schedule);
  },

  saveSchedule: async (s: Schedule) => {
    if (db) {
      const isNew = !(await getDoc(doc(db, KEYS.SCHEDULES, s.id))).exists();
      await setDoc(doc(db, KEYS.SCHEDULES, s.id), cleanData(s));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Schedule', `${isNew ? 'Nova solicitação' : 'Atualização'} de agendamento: ${s.vehiclePlate}`, s.id);
    }
  },

  deleteSchedule: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, KEYS.SCHEDULES, id));
      await storage.logAction(null, 'DELETE', 'Schedule', `Agendamento removido: ${id}`, id);
    }
  },

  subscribeToSchedules: (role: string, userId: string, onUpdate: (schedules: Schedule[]) => void) => {
    if (!db) return () => {};
    let q;
    if (role === 'user') {
      q = query(collection(db, KEYS.SCHEDULES), where('requesterId', '==', userId));
    } else if (role === 'technician') {
      q = query(collection(db, KEYS.SCHEDULES), where('technicianId', '==', userId));
    } else {
      q = query(collection(db, KEYS.SCHEDULES));
    }
    return onSnapshot(q, (snap) => {
        const schedules = snap.docs.map(d => d.data() as Schedule);
        onUpdate(schedules);
    });
  },

  // --- FEEDBACK & SUGGESTIONS ---
  saveFeedback: async (feedback: Feedback) => {
    if (db) {
      await setDoc(doc(db, KEYS.FEEDBACKS, feedback.id), cleanData(feedback));
      await storage.logAction(null, 'CREATE', 'Feedback', `Novo feedback enviado: ${feedback.type}`, feedback.id);
    }
  },

  getFeedbacks: async (): Promise<Feedback[]> => {
    if (!db) return [];
    const q = query(collection(db, KEYS.FEEDBACKS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Feedback);
  },

  // --- SYSTEM UPDATES (NOVIDADES) ---
  saveSystemUpdate: async (update: SystemUpdate) => {
    if (db) {
      const isNew = !(await getDoc(doc(db, KEYS.SYSTEM_UPDATES, update.id))).exists();
      await setDoc(doc(db, KEYS.SYSTEM_UPDATES, update.id), cleanData(update));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'SystemUpdate', `${isNew ? 'Nova atualização' : 'Edição'} de sistema: ${update.title}`, update.id);
    }
  },

  getSystemUpdates: async (): Promise<SystemUpdate[]> => {
    if (!db) return [];
    const q = query(collection(db, KEYS.SYSTEM_UPDATES), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as SystemUpdate);
  },

  deleteSystemUpdate: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, KEYS.SYSTEM_UPDATES, id));
      await storage.logAction(null, 'DELETE', 'SystemUpdate', `Atualização removida: ${id}`, id);
    }
  },

  deleteTag: async (id: string) => { 
    if (db) {
      await deleteDoc(doc(db, KEYS.TAGS, id));
      await storage.logAction(null, 'DELETE', 'Tag', `Tag removida: ${id}`, id);
    }
  },
  deleteVehicle: async (id: string) => { 
    if (db) {
      await deleteDoc(doc(db, KEYS.VEHICLES, id));
      await storage.logAction(null, 'DELETE', 'Vehicle', `Veículo removido: ${id}`, id);
    }
  },
  deleteClient: async (id: string) => { 
    if (db) {
      await deleteDoc(doc(db, KEYS.CLIENTS, id));
      await storage.logAction(null, 'DELETE', 'Client', `Cliente removido: ${id}`, id);
    }
  },
  deleteUser: async (id: string) => { 
    if (db) {
      await deleteDoc(doc(db, KEYS.USERS_DB, id));
      await storage.logAction(null, 'DELETE', 'User', `Usuário removido: ${id}`, id);
    }
  },
  
  // --- SHIPMENTS ---
  subscribeShipments: (callback: (shipments: Shipment[]) => void) => {
    if (!db) return () => {};
    const q = query(collection(db, KEYS.SHIPMENTS), orderBy('dataCriacao', 'desc'));
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
      const isNew = !(await getDoc(doc(db, KEYS.SHIPMENTS, s.id))).exists();
      await setDoc(doc(db, KEYS.SHIPMENTS, s.id), cleanData(encryptedShipment));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'Shipment', `${isNew ? 'Nova remessa' : 'Atualização de remessa'}: ${s.titulo}`, s.id);
    }
  },

  updateShipmentStatus: async (id: string, status: Shipment['status'], trackingCode?: string) => {
    if (db) {
      const docRef = doc(db, KEYS.SHIPMENTS, id);
      const updates: Partial<Shipment> = { status, updatedAt: Date.now() };
      if (trackingCode !== undefined) updates.codigoRastreio = trackingCode;
      if (status === 'enviado') updates.dataEnvio = Date.now();
      if (status === 'entregue') updates.dataEntrega = Date.now();
      await updateDoc(docRef, updates);
      await storage.logAction(null, 'UPDATE', 'Shipment', `Status da remessa alterado para ${status}`, id);
    }
  },

  updateShipment: async (id: string, updates: Partial<Shipment>) => {
    if (db) {
      const docRef = doc(db, KEYS.SHIPMENTS, id);
      await updateDoc(docRef, { ...updates, updatedAt: Date.now() });
      await storage.logAction(null, 'UPDATE', 'Shipment', `Dados da remessa atualizados via sync Melhor Envio`, id);
    }
  },

  deleteShipment: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, KEYS.SHIPMENTS, id));
      await storage.logAction(null, 'DELETE', 'Shipment', `Remessa removida: ${id}`, id);
    }
  },

  // --- SHIPPING ADDRESSES ---
  subscribeShippingAddresses: (consultorId: string | undefined, callback: (addresses: ShippingAddress[]) => void) => {
    if (!db) return () => {};
    const q = collection(db, KEYS.SHIPPING_ADDRESSES);
    return onSnapshot(q, async (snap) => {
      let raw = snap.docs.map(d => ({ ...d.data(), id: d.id })) as ShippingAddress[];
      if (consultorId) {
        raw = raw.filter(a => a.consultorId === consultorId);
      }
      await encryption.waitReady();
      const decrypted = await Promise.all(raw.map(async a => ({
        ...a,
        enderecoCompleto: await encryption.decrypt(a.enderecoCompleto)
      })));
      callback(decrypted);
    });
  },

  saveShippingAddress: async (a: ShippingAddress) => {
    await encryption.waitReady();
    const encryptedAddress = {
      ...a,
      enderecoCompleto: await encryption.encrypt(a.enderecoCompleto)
    };
    if (db) {
      const isNew = !(await getDoc(doc(db, KEYS.SHIPPING_ADDRESSES, a.id))).exists();
      await setDoc(doc(db, KEYS.SHIPPING_ADDRESSES, a.id), cleanData(encryptedAddress));
      await storage.logAction(null, isNew ? 'CREATE' : 'UPDATE', 'ShippingAddress', `${isNew ? 'Novo endereço' : 'Atualização de endereço'}: ${a.apelido}`, a.id);
    }
  },

  deleteShippingAddress: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, KEYS.SHIPPING_ADDRESSES, id));
      await storage.logAction(null, 'DELETE', 'ShippingAddress', `Endereço removido: ${id}`, id);
    }
  },

  // --- TECHNICIAN PAYMENTS ---
  getTechnicianPayments: async (technicianId?: string): Promise<any[]> => {
    if (!db) return [];
    try {
      let q: any = collection(db, KEYS.TECHNICIAN_PAYMENTS);
      if (technicianId) {
        q = query(q, where('technicianId', '==', technicianId));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.error("Error fetching technician payments", e);
      return [];
    }
  },

  saveTechnicianPayment: async (payment: any) => {
    if (db) {
      await setDoc(doc(db, KEYS.TECHNICIAN_PAYMENTS, payment.id), cleanData(payment));
      await storage.logAction(null, 'CREATE', 'TechnicianPayment', `Pagamento registrado: ${payment.id}`, payment.id);
    }
  },

  deleteTechnicianPayment: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, KEYS.TECHNICIAN_PAYMENTS, id));
      await storage.logAction(null, 'DELETE', 'TechnicianPayment', `Pagamento removido: ${id}`, id);
    }
  },

  getCustomRoles: async () => {
    if (!db) return [];
    const snap = await getDocs(collection(db, KEYS.CUSTOM_ROLES));
    return snap.docs.map(d => d.data() as any); // any mapped to CustomRole type
  },

  saveCustomRole: async (role: any) => {
    if (db) {
      await setDoc(doc(db, KEYS.CUSTOM_ROLES, role.id), cleanData(role));
      await storage.logAction(null, 'UPDATE', 'CustomRole', `Cargo salvo: ${role.name}`, role.id);
    }
  },

  deleteCustomRole: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, KEYS.CUSTOM_ROLES, id));
      await storage.logAction(null, 'DELETE', 'CustomRole', `Cargo deletado: ${id}`, id);
    }
  },

  getTheme: () => localStorage.getItem('ktag_theme') || 'light',
  setTheme: (t: string) => localStorage.setItem('ktag_theme', t),
  getNotifications: () => cache.get<AppNotification[]>(KEYS.NOTIFICATIONS, []),
  saveNotifications: (n: AppNotification[]) => cache.set(KEYS.NOTIFICATIONS, n),
};
