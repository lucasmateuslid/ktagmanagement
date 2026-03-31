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
   * Prioritizes Google Maps API if key is present, falls back to OpenStreetMap Nominatim.
   */
  reverseGeocode: async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cachedAddress = getFromCache(cacheKey);
    if (cachedAddress) {
      return cachedAddress;
    }

    // Cache settings for 5 minutes to avoid excessive Firestore reads
    const now = Date.now();
    if (!cachedSettings || now - settingsFetchTime > 5 * 60 * 1000) {
      cachedSettings = await storage.getSettings();
      settingsFetchTime = now;
    }
    const settings = cachedSettings;

    // Strategy 1: Google Maps
    if (settings?.googleMapsKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${settings.googleMapsKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results?.[0]) {
          const address = data.results[0].formatted_address;
          setToCache(cacheKey, address);
          return address;
        }
      } catch (e) {
        console.warn("Google Geocoding failed:", e);
      }
    }

    // Strategy 2: OpenStreetMap Nominatim (Free, requires User-Agent)
    try {
      // Throttle slightly to respect OSM policy
      await new Promise(r => setTimeout(r, 1000)); 
      
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'KTagManagerPro/1.0'
        }
      });
      
      if (res.status === 429) {
        console.warn("OSM Geocoding rate limited (429 Too Many Requests)");
        return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      }

      const data = await res.json();
      if (data && data.display_name) {
        const address = data.display_name;
        setToCache(cacheKey, address);
        return address;
      }
    } catch (e) {
      console.warn("OSM Geocoding failed:", e);
    }

    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  },

  geocode: async (query: string): Promise<{lat: number, lon: number, address: string}[]> => {
    const now = Date.now();
    if (!cachedSettings || now - settingsFetchTime > 5 * 60 * 1000) {
      cachedSettings = await storage.getSettings();
      settingsFetchTime = now;
    }
    const settings = cachedSettings;
    const apiKey = settings?.googleMapsKey;

    if (apiKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&language=pt-BR`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'OK' && data.results) {
          return data.results.map((r: any) => ({
            lat: r.geometry.location.lat,
            lon: r.geometry.location.lng,
            address: r.formatted_address
          }));
        }
      } catch (e) {
        console.warn("Google Geocoding failed:", e);
      }
    }

    try {
      await new Promise(r => setTimeout(r, 1000)); 
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'KTagManagerPro/1.0'
        }
      });
      
      const data = await res.json();
      if (data && Array.isArray(data)) {
        return data.map((r: any) => ({
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
          address: r.display_name
        }));
      }
    } catch (e) {
      console.warn("OSM Geocoding failed:", e);
    }

    return [];
  }
};