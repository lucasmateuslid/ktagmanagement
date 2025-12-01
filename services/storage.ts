
import { Tag, Vehicle, User, LocationHistory, AppSettings } from '../types';
import { db } from './firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, setDoc, writeBatch, getDoc } from 'firebase/firestore';

const KEYS = {
  USER: 'ktag_user',
  TAGS: 'ktag_tags',
  VEHICLES: 'ktag_vehicles',
  LOCATIONS: 'ktag_locations',
  THEME: 'ktag_theme',
  SETTINGS: 'ktag_settings',
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

// Default Settings
const DEFAULT_SETTINGS: AppSettings = {
  language: 'pt',
  customProxyUrl: '',
  ktagUrl: 'http://47.113.127.14:6176',
  ktagUser: 'TagLocation',
  ktagPass: 'a9B3xQ7z',
  googleMapsKey: '',
  mapboxKey: ''
};

// --- Storage Service Interface (Async) ---
// Now with robust error handling for Firestore offline states

export const storage = {
  // User
  getUser: async (): Promise<User | null> => {
    return getLocal<User | null>(KEYS.USER, null); 
  },
  setUser: async (user: User) => {
    setLocal(KEYS.USER, user);
  },
  clearUser: async () => {
    localStorage.removeItem(KEYS.USER);
  },

  // Tags
  getTags: async (): Promise<Tag[]> => {
    // Try Firestore first, merge/fallback to local
    if (db) {
      try {
        const snap = await getDocs(collection(db, KEYS.TAGS));
        const firestoreTags = snap.docs.map(d => ({ ...d.data(), id: d.id } as Tag));
        // Also update local for offline backup
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
        await setDoc(doc(db, KEYS.TAGS, tag.id), tag);
      } catch (e) {
        console.warn("Firestore saveTag failed, saving to local.", e);
      }
    }
    // Always save local
    const tags = getLocal<Tag[]>(KEYS.TAGS, []);
    const index = tags.findIndex((t) => t.id === tag.id);
    if (index >= 0) tags[index] = tag;
    else tags.push(tag);
    setLocal(KEYS.TAGS, tags);
  },
  deleteTag: async (id: string) => {
    console.log(`[Storage] Deleting tag: ${id}`);
    // Delete from Firestore
    if (db) {
      try {
        await deleteDoc(doc(db, KEYS.TAGS, id));
        console.log(`[Storage] Firestore delete success: ${id}`);
      } catch (e) {
        console.warn("Firestore deleteTag failed, continuing to local.", e);
      }
    }
    // Always delete from local to ensure UI updates immediately
    const tags = getLocal<Tag[]>(KEYS.TAGS, []);
    setLocal(KEYS.TAGS, tags.filter((t) => t.id !== id));
    console.log(`[Storage] Local delete complete: ${id}`);
  },
  deleteTags: async (ids: string[]) => {
    console.log(`[Storage] Deleting batch tags: ${ids.length}`);
    // Delete from Firestore
    if (db) {
      try {
        const batch = writeBatch(db);
        ids.forEach(id => {
          const ref = doc(db, KEYS.TAGS, id);
          batch.delete(ref);
        });
        await batch.commit();
        console.log(`[Storage] Firestore batch delete success`);
      } catch (e) {
         console.warn("Firestore deleteTags batch failed, continuing to local.", e);
      }
    }
    // Always delete from local
    const tags = getLocal<Tag[]>(KEYS.TAGS, []);
    setLocal(KEYS.TAGS, tags.filter((t) => !ids.includes(t.id)));
    console.log(`[Storage] Local batch delete complete`);
  },

  // Vehicles
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
        await setDoc(doc(db, KEYS.VEHICLES, vehicle.id), vehicle);
      } catch (e) {
        console.warn("Firestore saveVehicle failed, saving to local.", e);
      }
    }
    // Always save local
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
    // Always delete local
    const list = getLocal<Vehicle[]>(KEYS.VEHICLES, []);
    setLocal(KEYS.VEHICLES, list.filter((v) => v.id !== id));
  },

  // Locations (History)
  getLocations: async (tagId: string): Promise<LocationHistory[]> => {
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
        console.warn("Firestore getLocations failed, using fallback.", e);
        return fallback();
      }
    }
    return fallback();
  },
  addLocation: async (loc: LocationHistory) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.LOCATIONS, loc.id), loc);
      } catch (e) {
        console.warn("Firestore addLocation failed, saving to local.", e);
      }
    }
    // Always add to local for redundancy
    const all = getLocal<LocationHistory[]>(KEYS.LOCATIONS, []);
    if (!all.find((e) => e.timestamp === loc.timestamp && e.tagId === loc.tagId)) {
      all.push(loc);
      setLocal(KEYS.LOCATIONS, all);
    }
  },
  
  // Settings
  getSettings: async (): Promise<AppSettings> => {
    const fallback = () => getLocal<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
    if (db) {
      try {
        const ref = doc(db, KEYS.SETTINGS, 'config');
        const snap = await getDoc(ref);
        if (snap.exists()) {
           const data = { ...DEFAULT_SETTINGS, ...snap.data() };
           setLocal(KEYS.SETTINGS, data); // Sync local
           return data;
        }
        return DEFAULT_SETTINGS;
      } catch (e) {
        console.warn("Firestore getSettings failed, using fallback.", e);
        return fallback();
      }
    }
    return fallback();
  },
  saveSettings: async (settings: AppSettings) => {
    if (db) {
      try {
        await setDoc(doc(db, KEYS.SETTINGS, 'config'), settings);
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
