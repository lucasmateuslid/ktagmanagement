import { traccarClient } from './traccarClient.js';

export type ServerAddressResult = {
  address: string | null;
  provider: 'existing' | 'traccar' | 'photon' | 'openstreetmap' | null;
  attempts: number;
};

type CacheEntry = { expiresAt: number; result: ServerAddressResult };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = Number(process.env.SERVER_ADDRESS_CACHE_TTL_MS) || 24 * 60 * 60_000;
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'KTagManagerPro/5.1 ServerWorker';

const key = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;
const validCoordinates = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon)
  && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0);

const fetchJson = async (url: string) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Geocodificador respondeu HTTP ${response.status}.`);
  return response.json() as Promise<any>;
};

const remember = (cacheKey: string, result: ServerAddressResult) => {
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
};

/** Geocodificação reversa exclusiva do backend/worker; nunca depende da sessão web. */
export async function resolveServerAddress(lat: number, lon: number, existing?: string | null, force = false): Promise<ServerAddressResult> {
  if (!force && existing?.trim()) return { address: existing.trim(), provider: 'existing', attempts: 0 };
  if (!validCoordinates(lat, lon)) return { address: null, provider: null, attempts: 0 };
  const cacheKey = key(lat, lon); const cached = cache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.result;

  let attempts = 0;
  if (traccarClient.safeConfig.configured) {
    attempts++;
    try {
      const address = await traccarClient.reverseGeocode(lat, lon);
      if (address) return remember(cacheKey, { address, provider: 'traccar', attempts });
    } catch { /* tenta provedores públicos */ }
  }

  attempts++;
  try {
    const data = await fetchJson(`https://photon.komoot.io/reverse?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}`);
    const feature = data?.features?.[0]; const properties = feature?.properties || {};
    const address = [properties.name, properties.street, properties.housenumber, properties.district, properties.city, properties.state, properties.country]
      .filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
    if (address) return remember(cacheKey, { address, provider: 'photon', attempts });
  } catch { /* tenta OSM */ }

  attempts++;
  try {
    const data = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1`);
    if (typeof data?.display_name === 'string' && data.display_name.trim()) {
      return remember(cacheKey, { address: data.display_name.trim(), provider: 'openstreetmap', attempts });
    }
  } catch { /* endereço permanece pendente */ }

  console.warn(JSON.stringify({ event: 'fleet.address.unavailable', lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)), attempts }));
  return remember(cacheKey, { address: null, provider: null, attempts });
}

export const samePosition = (position: any, lat: number, lon: number) => Boolean(position)
  && Math.abs(Number(position.lat ?? position.latitude) - lat) < 0.00001
  && Math.abs(Number(position.lon ?? position.longitude) - lon) < 0.00001;
