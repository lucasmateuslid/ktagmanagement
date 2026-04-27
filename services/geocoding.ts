import { storage } from './storage';

const CACHE_KEY = 'ktag_geocode_cache';
const CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  address: string;
  timestamp: number;
}

let geocodeCache: Map<string, CacheEntry> | null = null;
let cachedSettings: any = null;
let settingsFetchTime = 0;

const initCache = () => {
  if (geocodeCache) return;
  geocodeCache = new Map();
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, CacheEntry>;
      const now = Date.now();
      
      // Load and clean up expired entries
      let hasExpired = false;
      Object.entries(parsed).forEach(([key, entry]) => {
        if (now - entry.timestamp < CACHE_EXPIRATION_MS) {
          geocodeCache!.set(key, entry);
        } else {
          hasExpired = true;
        }
      });
      
      if (hasExpired) {
        saveCache();
      }
    }
  } catch (e) {
    console.warn("Failed to load geocode cache", e);
  }
};

const saveCache = () => {
  if (!geocodeCache) return;
  try {
    const obj = Object.fromEntries(geocodeCache.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn("Failed to save geocode cache", e);
  }
};

const getFromCache = (key: string): string | null => {
  initCache();
  const entry = geocodeCache!.get(key);
  if (entry) {
    if (Date.now() - entry.timestamp < CACHE_EXPIRATION_MS) {
      return entry.address;
    } else {
      geocodeCache!.delete(key);
      saveCache();
    }
  }
  return null;
};

const setToCache = (key: string, address: string) => {
  initCache();
  geocodeCache!.set(key, { address, timestamp: Date.now() });
  saveCache();
};

export const geocodingService = {
  /**
   * Converts Lat/Lon to a human-readable address.
   */
  reverseGeocode: async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cachedAddress = getFromCache(cacheKey);
    if (cachedAddress) {
      return cachedAddress;
    }

    try {
      const settings = await storage.getSettings();
      const providerPreference = settings.geocodingProvider || 'osm';

      const res = await fetch('/api/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng: lon, providerPreference })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.displayName) {
          setToCache(cacheKey, data.displayName);
          return data.displayName;
        }
      }
    } catch (e) {
      console.warn("Reverse geocoding API failed:", e);
    }

    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  },

  geocode: async (query: string): Promise<{lat: number, lon: number, address: string}[]> => {
    try {
      const settings = await storage.getSettings();
      const providerPreference = settings.geocodingProvider || 'osm';

      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: query, providerPreference })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.lat !== undefined && data.lng !== undefined) {
          return [{
            lat: data.lat,
            lon: data.lng,
            address: data.displayName
          }];
        }
      }
    } catch (e) {
      console.warn("Geocoding API failed:", e);
    }

    return [];
  }
};
