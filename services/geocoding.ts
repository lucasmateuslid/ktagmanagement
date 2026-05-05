import { storage } from './storage';

const CACHE_KEY = 'ktag_geocode_cache';
const CACHE_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 1000;

interface CacheEntry {
  address: string;
  timestamp: number;
}

let geocodeCache: Map<string, CacheEntry> | null = null;
let saveCacheTimeout: ReturnType<typeof setTimeout> | null = null;
const pendingRequests = new Map<string, Promise<string>>();

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
      const entries = Object.entries(parsed)
        .filter(([_, entry]) => {
          if (now - entry.timestamp < CACHE_EXPIRATION_MS) {
            return true;
          }
          hasExpired = true;
          return false;
        })
        .sort((a, b) => b[1].timestamp - a[1].timestamp) // Sort newest first
        .slice(0, MAX_CACHE_SIZE); // Enforce max size on load

      entries.forEach(([key, entry]) => {
        geocodeCache!.set(key, entry);
      });
      
      if (hasExpired || entries.length < Object.keys(parsed).length) {
        scheduleSaveCache();
      }
    }
  } catch (e) {
    console.warn("Failed to load geocode cache", e);
  }
};

const scheduleSaveCache = () => {
  if (saveCacheTimeout) {
    clearTimeout(saveCacheTimeout);
  }
  saveCacheTimeout = setTimeout(() => {
    saveCache();
  }, 1000);
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
      scheduleSaveCache();
    }
  }
  return null;
};

const setToCache = (key: string, address: string) => {
  initCache();
  
  // Evict oldest if we hit the limit
  if (geocodeCache!.size >= MAX_CACHE_SIZE) {
    const oldestKey = geocodeCache!.keys().next().value;
    if (oldestKey) geocodeCache!.delete(oldestKey);
  }
  
  // Map preserves insertion order, so delete and re-set makes it the newest
  geocodeCache!.delete(key);
  geocodeCache!.set(key, { address, timestamp: Date.now() });
  
  scheduleSaveCache();
};

export const geocodingService = {
  /**
   * Converts Lat/Lon to a human-readable address.
   */
  reverseGeocode: async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    
    // 1. Check Cache
    const cachedAddress = getFromCache(cacheKey);
    if (cachedAddress) {
      return cachedAddress;
    }

    // 2. Check Pending Requests (Promise Coalescing)
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey)!;
    }

    // 3. Execute Fetch
    const fetchPromise = (async () => {
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
      } finally {
        pendingRequests.delete(cacheKey);
      }
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
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
