
import { Tag, Vehicle, User, LocationHistory, AppSettings, Company, VehicleCategory, StolenRecord, Client } from '../types';
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, setDoc, writeBatch, getDoc, orderBy } from 'firebase/firestore';

const KEYS = {
  USER_SESSION: 'ktag_user_session',
  USERS_DB: 'ktag_users_db',
  TAGS: 'ktag_tags',
  VEHICLES: 'ktag_vehicles',
  CLIENTS: 'ktag_clients', // New Key
  LOCATIONS: 'ktag_locations',
  THEME: 'ktag_theme',
  SETTINGS: 'ktag_settings_v3', // VERSION BUMP: Forces refresh of defaults for new Hinova fields
  COMPANIES: 'ktag_companies',
  CATEGORIES: 'ktag_categories',
  STOLEN_RECORDS: 'ktag_stolen_records',
};

// --- LocalStorage Helpers (Fallback) ---
const getLocal = <T>(key: string, def: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : def;
  } catch (e) {
    console.error("LocalStorage access error:", e);
    return def;
  }
};

const setLocal = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("LocalStorage write error:", e);
  }
};

// --- Firestore Helper: Remove undefined values ---
// Firestore crashes if you pass 'undefined' as a value.
const cleanData = <T extends Record<string, any>>(data: T): T => {
  const copy = { ...data };
  Object.keys(copy).forEach(key => {
    if (copy[key] === undefined) {
      delete copy[key];
    }
  });
  return copy;
};

// Default Settings
const DEFAULT_SETTINGS: AppSettings = {
  language: 'pt',
  customProxyUrl: '',
  ktagUrl: 'http://47.113.127.14:6176',
  ktagUser: 'TagLocation',
  ktagPass: 'a9B3xQ7z',
  googleMapsKey: '',
  mapboxKey: '',
  plateApiUrl: '',
  plateApiToken: '',
  hinovaUrl: 'https://api.hinova.com.br/api/sga/v2',
  hinovaToken: '19d988945b90e0a3abf0b441a5477126f952dd20d699eeb4e7e766f1289fd557b3ebc22097925f1b1903f3407de4b8dc44184e21f2f6d760f4f9c340a3902de0bd6db4a9356458c67b4e871ba04898c49b9f5a71af9d7461ae34c902477ad12d',
  hinovaUser: '',
  hinovaPass: ''
};

// Default Categories to initialize
const DEFAULT_CATEGORIES: VehicleCategory[] = [
  { id: 'cat-car', name: 'Carro de Passeio', fipeType: 'carros' },
  { id: 'cat-truck', name: 'Caminhão', fipeType: 'caminhoes' },
  { id: 'cat-moto', name: 'Motocicleta', fipeType: 'motos' },
];

export const storage = {
  // --- USER SESSION (Current Logged In) ---
  getSessionUser: async (): Promise<User | null> => {
    return getLocal<User | null>(KEYS.USER_SESSION, null); 
  },
  setSessionUser: async (user: User) => {
    setLocal(KEYS.USER_SESSION, user);
  },
  clearSessionUser: async () => {
    localStorage.removeItem(KEYS.USER_SESSION);
  },

  // --- USER MANAGEMENT (DB) ---
  findUserByEmail: async (email: string): Promise<User | null> => {
    if (db) {
      try {
        const q = query(collection(db, KEYS.USERS_DB), where("email", "==", email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          return { ...d.data(), id: d.id } as User;
        }
      } catch (e) {
        console.warn("Firestore findUser failed", e);
      }
    }
    const localUsers = getLocal<User[]>(KEYS.USERS_DB, []);
    return localUsers.find(u => u.email === email) || null;
  },

  registerUserRequest: async (user: User) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.USERS_DB, user.id), cleanData(user));
        return;
      } catch (e) {
        console.error("Firestore register failed", e);
      }
    }
    const users = getLocal<User[]>(KEYS.USERS_DB, []);
    users.push(user);
    setLocal(KEYS.USERS_DB, users);
  },

  getAllUsers: async (): Promise<User[]> => {
    if (db) {
      try {
        const snap = await getDocs(collection(db, KEYS.USERS_DB));
        return snap.docs.map(d => ({...d.data(), id: d.id} as User));
      } catch (e) {
        console.warn("Firestore getAllUsers failed", e);
      }
    }
    return getLocal<User[]>(KEYS.USERS_DB, []);
  },

  updateUserStatus: async (userId: string, status: 'approved' | 'rejected') => {
    if (db) {
      try {
        await updateDoc(doc(db, KEYS.USERS_DB, userId), { status });
      } catch (e) {
        console.error("Firestore updateStatus failed", e);
      }
    }
    const users = getLocal<User[]>(KEYS.USERS_DB, []);
    const idx = users.findIndex(u => u.id === userId);
    if (idx >= 0) {
      users[idx].status = status;
      setLocal(KEYS.USERS_DB, users);
    }
  },

  updateUserProfile: async (userId: string, data: Partial<User>) => {
    // 1. Update DB
    if (db) {
      try {
        const userRef = doc(db, KEYS.USERS_DB, userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
           // Normal update if document exists
           await updateDoc(userRef, cleanData(data));
        } else {
           // Handle cases like 'root-admin' which might exist in session but not in DB yet.
           // We try to reconstruct the full object from local session to ensure DB integrity.
           const localSession = getLocal<User | null>(KEYS.USER_SESSION, null);
           if (localSession && localSession.id === userId) {
               const fullUser = { ...localSession, ...data };
               await setDoc(userRef, cleanData(fullUser));
           } else {
               // Fallback: Create partial doc (better than failing)
               await setDoc(userRef, cleanData(data), { merge: true });
           }
        }
      } catch (e) {
        console.error("Firestore updateUserProfile failed", e);
      }
    }
    
    // 2. Update Local List
    const users = getLocal<User[]>(KEYS.USERS_DB, []);
    const idx = users.findIndex(u => u.id === userId);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...data };
      setLocal(KEYS.USERS_DB, users);
    }

    // 3. Update Session if it matches current user
    const currentSession = getLocal<User | null>(KEYS.USER_SESSION, null);
    if (currentSession && currentSession.id === userId) {
        setLocal(KEYS.USER_SESSION, { ...currentSession, ...data });
    }
  },

  // --- COMPANIES ---
  getCompanies: async (): Promise<Company[]> => {
    if (db) {
      try {
        const snap = await getDocs(collection(db, KEYS.COMPANIES));
        const firestoreData = snap.docs.map(d => ({ ...d.data(), id: d.id } as Company));
        setLocal(KEYS.COMPANIES, firestoreData);
        return firestoreData;
      } catch (e) {
        console.warn("Firestore getCompanies failed", e);
      }
    }
    return getLocal<Company[]>(KEYS.COMPANIES, []);
  },
  saveCompany: async (company: Company) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.COMPANIES, company.id), cleanData(company));
      } catch (e) {
        console.warn("Firestore saveCompany failed", e);
      }
    }
    const list = getLocal<Company[]>(KEYS.COMPANIES, []);
    const index = list.findIndex(c => c.id === company.id);
    if (index >= 0) list[index] = company;
    else list.push(company);
    setLocal(KEYS.COMPANIES, list);
  },
  deleteCompany: async (id: string) => {
    if (db) {
      try { await deleteDoc(doc(db, KEYS.COMPANIES, id)); } catch (e) {}
    }
    const list = getLocal<Company[]>(KEYS.COMPANIES, []);
    setLocal(KEYS.COMPANIES, list.filter(c => c.id !== id));
  },

  // --- VEHICLE CATEGORIES ---
  getCategories: async (): Promise<VehicleCategory[]> => {
    // Ensure defaults exist locally first time
    let localData = getLocal<VehicleCategory[]>(KEYS.CATEGORIES, []);
    if (localData.length === 0) {
        localData = DEFAULT_CATEGORIES;
        setLocal(KEYS.CATEGORIES, localData);
    }

    if (db) {
      try {
        const snap = await getDocs(collection(db, KEYS.CATEGORIES));
        if (snap.empty) {
            // Seed defaults if empty
            const batch = writeBatch(db);
            DEFAULT_CATEGORIES.forEach(c => batch.set(doc(db, KEYS.CATEGORIES, c.id), c));
            await batch.commit();
            return DEFAULT_CATEGORIES;
        }
        const firestoreData = snap.docs.map(d => ({ ...d.data(), id: d.id } as VehicleCategory));
        setLocal(KEYS.CATEGORIES, firestoreData);
        return firestoreData;
      } catch (e) {
        console.warn("Firestore getCategories failed", e);
      }
    }
    return localData;
  },
  saveCategory: async (category: VehicleCategory) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.CATEGORIES, category.id), cleanData(category));
      } catch (e) {
        console.warn("Firestore saveCategory failed", e);
      }
    }
    const list = getLocal<VehicleCategory[]>(KEYS.CATEGORIES, []);
    const index = list.findIndex(c => c.id === category.id);
    if (index >= 0) list[index] = category;
    else list.push(category);
    setLocal(KEYS.CATEGORIES, list);
  },
  deleteCategory: async (id: string) => {
    if (db) {
      try { await deleteDoc(doc(db, KEYS.CATEGORIES, id)); } catch (e) {}
    }
    const list = getLocal<VehicleCategory[]>(KEYS.CATEGORIES, []);
    setLocal(KEYS.CATEGORIES, list.filter(c => c.id !== id));
  },

  // --- CLIENTS (NEW) ---
  getClients: async (): Promise<Client[]> => {
    if (db) {
      try {
        const snap = await getDocs(collection(db, KEYS.CLIENTS));
        const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Client));
        setLocal(KEYS.CLIENTS, data);
        return data;
      } catch (e) {
        console.warn("Firestore getClients failed", e);
      }
    }
    return getLocal<Client[]>(KEYS.CLIENTS, []);
  },
  saveClient: async (client: Client) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.CLIENTS, client.id), cleanData(client));
      } catch (e) {
        console.warn("Firestore saveClient failed", e);
      }
    }
    const list = getLocal<Client[]>(KEYS.CLIENTS, []);
    const index = list.findIndex(c => c.id === client.id);
    if (index >= 0) list[index] = client;
    else list.push(client);
    setLocal(KEYS.CLIENTS, list);
  },
  deleteClient: async (id: string) => {
    if (db) {
      try { await deleteDoc(doc(db, KEYS.CLIENTS, id)); } catch (e) {}
    }
    const list = getLocal<Client[]>(KEYS.CLIENTS, []);
    setLocal(KEYS.CLIENTS, list.filter(c => c.id !== id));
  },

  // --- TAGS ---
  getTags: async (): Promise<Tag[]> => {
    if (db) {
      try {
        const snap = await getDocs(collection(db, KEYS.TAGS));
        const firestoreTags = snap.docs.map(d => ({ ...d.data(), id: d.id } as Tag));
        setLocal(KEYS.TAGS, firestoreTags); 
        return firestoreTags;
      } catch (e) {
        console.warn("Firestore getTags failed (offline?), using fallback.", e);
      }
    }
    return getLocal<Tag[]>(KEYS.TAGS, []);
  },
  saveTag: async (tag: Tag) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.TAGS, tag.id), cleanData(tag));
      } catch (e) {
        console.warn("Firestore saveTag failed, saving to local.", e);
      }
    }
    const tags = getLocal<Tag[]>(KEYS.TAGS, []);
    const index = tags.findIndex((t) => t.id === tag.id);
    if (index >= 0) tags[index] = tag;
    else tags.push(tag);
    setLocal(KEYS.TAGS, tags);
  },
  deleteTag: async (id: string) => {
    if (db) {
      try {
        await deleteDoc(doc(db, KEYS.TAGS, id));
      } catch (e) {
        console.warn("Firestore deleteTag failed, continuing to local.", e);
      }
    }
    const tags = getLocal<Tag[]>(KEYS.TAGS, []);
    setLocal(KEYS.TAGS, tags.filter((t) => t.id !== id));
  },
  deleteTags: async (ids: string[]) => {
    if (db) {
      try {
        const batch = writeBatch(db);
        ids.forEach(id => {
          const ref = doc(db, KEYS.TAGS, id);
          batch.delete(ref);
        });
        await batch.commit();
      } catch (e) {
         console.warn("Firestore deleteTags batch failed, continuing to local.", e);
      }
    }
    const tags = getLocal<Tag[]>(KEYS.TAGS, []);
    setLocal(KEYS.TAGS, tags.filter((t) => !ids.includes(t.id)));
  },

  // --- VEHICLES ---
  getVehicles: async (): Promise<Vehicle[]> => {
    if (db) {
      try {
        const snap = await getDocs(collection(db, KEYS.VEHICLES));
        const firestoreVehicles = snap.docs.map(d => ({ ...d.data(), id: d.id } as Vehicle));
        setLocal(KEYS.VEHICLES, firestoreVehicles);
        return firestoreVehicles;
      } catch (e) {
        console.warn("Firestore getVehicles failed, using fallback.", e);
      }
    }
    return getLocal<Vehicle[]>(KEYS.VEHICLES, []);
  },
  saveVehicle: async (vehicle: Vehicle) => {
    if (db) {
      try {
        // Use cleanData to avoid "undefined" fields which crash Firestore
        await setDoc(doc(db, KEYS.VEHICLES, vehicle.id), cleanData(vehicle));
      } catch (e) {
        console.warn("Firestore saveVehicle failed, saving to local.", e);
      }
    }
    const list = getLocal<Vehicle[]>(KEYS.VEHICLES, []);
    const index = list.findIndex((v) => v.id === vehicle.id);
    if (index >= 0) list[index] = vehicle;
    else list.push(vehicle);
    setLocal(KEYS.VEHICLES, list);
  },
  deleteVehicle: async (id: string) => {
    if (db) {
      try {
        await deleteDoc(doc(db, KEYS.VEHICLES, id));
      } catch (e) {
        console.warn("Firestore deleteVehicle failed, continuing to local.", e);
      }
    }
    const list = getLocal<Vehicle[]>(KEYS.VEHICLES, []);
    setLocal(KEYS.VEHICLES, list.filter((v) => v.id !== id));
  },

  // --- LOCATIONS ---
  pruneHistory: async (tagId: string) => {
    const HOURS_128 = 128 * 60 * 60 * 1000;
    const cutoff = Date.now() - HOURS_128;
    
    // Prune Local
    const allLocal = getLocal<LocationHistory[]>(KEYS.LOCATIONS, []);
    const prunedLocal = allLocal.filter(l => l.timestamp >= cutoff);
    if (allLocal.length !== prunedLocal.length) {
       setLocal(KEYS.LOCATIONS, prunedLocal);
    }

    // Prune Firestore
    if (db) {
      try {
        const q = query(
           collection(db, KEYS.LOCATIONS), 
           where("tagId", "==", tagId),
           where("timestamp", "<", cutoff)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
           const batch = writeBatch(db);
           snap.docs.forEach(d => batch.delete(d.ref));
           await batch.commit();
        }
      } catch (e) {
         console.warn("Firestore prune failed", e);
      }
    }
  },

  clearTagHistory: async (tagId: string) => {
    const allLocal = getLocal<LocationHistory[]>(KEYS.LOCATIONS, []);
    const prunedLocal = allLocal.filter(l => l.tagId !== tagId);
    setLocal(KEYS.LOCATIONS, prunedLocal);

    if (db) {
      try {
        const q = query(
          collection(db, KEYS.LOCATIONS),
          where("tagId", "==", tagId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (e) {
        console.warn("Firestore clear history failed", e);
      }
    }
  },

  getLocations: async (tagId: string): Promise<LocationHistory[]> => {
    storage.pruneHistory(tagId);

    const fallback = () => {
      const all = getLocal<LocationHistory[]>(KEYS.LOCATIONS, []);
      return all.filter((l) => l.tagId === tagId).sort((a, b) => b.timestamp - a.timestamp);
    };

    if (db) {
      try {
        const q = query(collection(db, KEYS.LOCATIONS), where("tagId", "==", tagId));
        const snap = await getDocs(q);
        const locs = snap.docs.map(d => d.data() as LocationHistory);
        return locs.sort((a, b) => b.timestamp - a.timestamp);
      } catch (e) {
        return fallback();
      }
    }
    return fallback();
  },
  
  addLocation: async (loc: LocationHistory) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.LOCATIONS, loc.id), cleanData(loc));
      } catch (e) {
        console.warn("Firestore addLocation failed, saving to local.", e);
      }
    }
    const all = getLocal<LocationHistory[]>(KEYS.LOCATIONS, []);
    if (!all.find((e) => e.timestamp === loc.timestamp && e.tagId === loc.tagId)) {
      all.push(loc);
      setLocal(KEYS.LOCATIONS, all);
    }
  },

  // --- STOLEN RECORDS ---
  getStolenRecords: async (): Promise<StolenRecord[]> => {
    if (db) {
      try {
        const q = query(collection(db, KEYS.STOLEN_RECORDS), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as StolenRecord);
      } catch (e) {
        console.warn("Firestore getStolenRecords failed", e);
      }
    }
    return getLocal<StolenRecord[]>(KEYS.STOLEN_RECORDS, []);
  },

  reportTheft: async (record: StolenRecord) => {
    // 1. Save Record
    if (db) {
      try {
        await setDoc(doc(db, KEYS.STOLEN_RECORDS, record.id), cleanData(record));
      } catch (e) { console.warn("Firestore saveRecord failed", e); }
    }
    const list = getLocal<StolenRecord[]>(KEYS.STOLEN_RECORDS, []);
    list.unshift(record);
    setLocal(KEYS.STOLEN_RECORDS, list);

    // 2. Update Vehicle Status
    const vehicle = (await storage.getVehicles()).find(v => v.id === record.vehicleId);
    if (vehicle) {
      const updatedVehicle = { ...vehicle, status: 'stolen' as const };
      await storage.saveVehicle(updatedVehicle);
    }
  },

  recoverVehicle: async (recordId: string, vehicleId: string) => {
    const recoveredAt = Date.now();
    
    // 1. Update Record
    if (db) {
      try {
        await updateDoc(doc(db, KEYS.STOLEN_RECORDS, recordId), { status: 'recovered', recoveredAt });
      } catch (e) { console.warn("Firestore updateRecord failed", e); }
    }
    const list = getLocal<StolenRecord[]>(KEYS.STOLEN_RECORDS, []);
    const idx = list.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: 'recovered', recoveredAt };
      setLocal(KEYS.STOLEN_RECORDS, list);
    }

    // 2. Update Vehicle Status
    const vehicle = (await storage.getVehicles()).find(v => v.id === vehicleId);
    if (vehicle) {
      const updatedVehicle = { ...vehicle, status: 'active' as const };
      await storage.saveVehicle(updatedVehicle);
    }
  },
  
  // --- SETTINGS ---
  getSettings: async (): Promise<AppSettings> => {
    // Attempt to load from new key first
    const fallback = () => getLocal<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
    
    if (db) {
      try {
        const ref = doc(db, KEYS.SETTINGS, 'config');
        const snap = await getDoc(ref);
        if (snap.exists()) {
           const data = { ...DEFAULT_SETTINGS, ...snap.data() };
           setLocal(KEYS.SETTINGS, data); 
           return data;
        }
        return DEFAULT_SETTINGS;
      } catch (e) {
        return fallback();
      }
    }
    return fallback();
  },
  saveSettings: async (settings: AppSettings) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.SETTINGS, 'config'), cleanData(settings));
      } catch (e) {
        console.warn("Firestore saveSettings failed, saving to local.", e);
      }
    }
    setLocal(KEYS.SETTINGS, settings);
  },

  // Theme (Local only)
  getTheme: (): 'light' | 'dark' => getLocal<'light' | 'dark'>(KEYS.THEME, 'light'),
  setTheme: (theme: 'light' | 'dark') => setLocal(KEYS.THEME, theme),
};
