import { traccarClient } from './traccarClient.js';

export type ServerAddressResult = {
  address: string | null;
  provider: 'existing' | 'traccar' | 'photon' | 'openstreetmap' | null;
  attempts: number;
};

type CacheEntry = { expiresAt: number; result: ServerAddressResult };
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 10_000;
const CACHE_TTL_MS = Number(process.env.SERVER_ADDRESS_CACHE_TTL_MS) || 24 * 60 * 60_000;
const FAILURE_CACHE_TTL_MS = Number(process.env.SERVER_ADDRESS_FAILURE_CACHE_TTL_MS) || 5 * 60_000;
const CIRCUIT_FAILURE_LIMIT = Number(process.env.SERVER_ADDRESS_CIRCUIT_FAILURE_LIMIT) || 3;
const CIRCUIT_OPEN_MS = Number(process.env.SERVER_ADDRESS_CIRCUIT_OPEN_MS) || 5 * 60_000;
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'KTagManagerPro/5.1 ServerWorker';
// Public endpoints cannot carry an automated fleet workload. Opt in only for small installations.
const publicPhotonEnabled = () => process.env.SERVER_ADDRESS_PUBLIC_PHOTON === 'true';
const MAX_PHOTON_DISTANCE_METERS = 100;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;
export const addressResolverAvailable = () => traccarClient.safeConfig.configured || publicPhotonEnabled();

const key = (lat: number, lon: number) => `${lat.toFixed(6)},${lon.toFixed(6)}`;
const validCoordinates = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon)
  && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0);

const fetchJson = async (url: string) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Geocodificador respondeu HTTP ${response.status}.`);
  return response.json() as Promise<any>;
};

const remember = (cacheKey: string, result: ServerAddressResult) => {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { expiresAt: Date.now() + (result.address ? CACHE_TTL_MS : FAILURE_CACHE_TTL_MS), result });
  return result;
};

export const distanceMeters = (lat: number, lon: number, otherLat: number, otherLon: number) => {
  const toRadians = Math.PI / 180;
  const deltaLat = (otherLat - lat) * toRadians;
  const deltaLon = (otherLon - lon) * toRadians;
  const arc = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat * toRadians) * Math.cos(otherLat * toRadians) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
};

export const photonAddressForPoint = (data: any, lat: number, lon: number): string | null => {
  const feature = data?.features?.[0];
  const [featureLon, featureLat] = feature?.geometry?.coordinates || [];
  if (!validCoordinates(Number(featureLat), Number(featureLon))
    || distanceMeters(lat, lon, Number(featureLat), Number(featureLon)) > MAX_PHOTON_DISTANCE_METERS) return null;
  const properties = feature.properties || {};
  const address = [properties.name, properties.street, properties.housenumber, properties.district, properties.city, properties.state, properties.country]
    .filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ');
  return address || null;
};

/** Geocodificação reversa exclusiva do backend/worker; nunca depende da sessão web. */
export async function resolveServerAddress(lat: number, lon: number, existing?: string | null, force = false): Promise<ServerAddressResult> {
  if (!force && existing?.trim()) return { address: existing.trim(), provider: 'existing', attempts: 0 };
  if (!validCoordinates(lat, lon)) return { address: null, provider: null, attempts: 0 };
  const cacheKey = key(lat, lon); const cached = cache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.result;
  if (Date.now() < circuitOpenUntil) return { address: null, provider: null, attempts: 0 };

  let attempts = 0;
  if (traccarClient.safeConfig.configured) {
    attempts++;
    try {
      const address = await traccarClient.reverseGeocode(lat, lon);
      if (address) { consecutiveFailures = 0; return remember(cacheKey, { address, provider: 'traccar', attempts }); }
    } catch { /* endereço fica pendente se não houver outro provedor autorizado */ }
  }

  if (publicPhotonEnabled()) {
    attempts++;
    try {
      const data = await fetchJson(`https://photon.komoot.io/reverse?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}&radius=0.1`);
      const address = photonAddressForPoint(data, lat, lon);
      if (address) { consecutiveFailures = 0; return remember(cacheKey, { address, provider: 'photon', attempts }); }
    } catch { /* endereço permanece pendente */ }
  }

  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_FAILURE_LIMIT) circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
  console.warn(JSON.stringify({ event: 'fleet.address.unavailable', lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)), attempts, circuitOpen: circuitOpenUntil > Date.now() }));
  return remember(cacheKey, { address: null, provider: null, attempts });
}

export const samePosition = (position: any, lat: number, lon: number) => Boolean(position)
  && Math.abs(Number(position.lat ?? position.latitude) - lat) < 0.00001
  && Math.abs(Number(position.lon ?? position.longitude) - lon) < 0.00001;

/** Legacy public geocoder results were not distance-checked; do not carry them forward. */
export const reusableAddressAt = (position: any, lat: number, lon: number): string => {
  if (!samePosition(position, lat, lon) || typeof position.address !== 'string') return '';
  const origin = String(position.addressResolutionProvider || '');
  return origin === 'traccar' || (origin === 'photon' && Number(position.addressVerifiedAt) > 0)
    || (origin === '' && position.provider === 'traccar') ? position.address.trim() : '';
};

export const displayAddressAt = (position: any): string | null => {
  const address = typeof position?.address === 'string' ? position.address.trim() : '';
  const origin = String(position?.addressResolutionProvider || '');
  if (!address || (!origin && position?.provider === 'ktag')
    || (['photon', 'openstreetmap', 'existing'].includes(origin) && !Number(position?.addressVerifiedAt))) return null;
  return address;
};
