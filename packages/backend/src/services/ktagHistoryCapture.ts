import { createHash } from 'node:crypto';

export interface KtagSnapshot {
  timestamp: number;
  lat: number;
  lon: number;
  conf: number;
  status: number;
  isodatetime: string;
}

export const normalizeKtagSnapshot = (raw: Record<string, unknown>): KtagSnapshot | null => {
  const lat = Number(raw.lat); const lon = Number(raw.lon); const sourceTimestamp = Number(raw.timestamp);
  const timestamp = sourceTimestamp < 1e12 ? sourceTimestamp * 1_000 : sourceTimestamp;
  if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return { timestamp, lat, lon, conf: Number.isFinite(Number(raw.conf)) ? Number(raw.conf) : 0, status: Number.isFinite(Number(raw.status)) ? Number(raw.status) : -1, isodatetime: typeof raw.isodatetime === 'string' && Number.isFinite(Date.parse(raw.isodatetime)) ? raw.isodatetime : date.toISOString() };
};

export const ktagHistoryPointId = (tagId: string, point: Pick<KtagSnapshot, 'timestamp' | 'lat' | 'lon'>) => createHash('sha256').update(`${tagId}|${point.timestamp}|${point.lat}|${point.lon}`).digest('hex');

export const isRetryableKtagStatus = (status: number) => status === 429 || status >= 500;

export async function fetchKtagWithRetry(
  load: () => Promise<Response>,
  options: { attempts?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void>; random?: () => number } = {},
): Promise<Response> {
  const attempts = Math.max(1, options.attempts ?? 4); const baseDelayMs = Math.max(1, options.baseDelayMs ?? 500);
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))); const random = options.random ?? Math.random;
  let lastResponse: Response | null = null; let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await load(); lastResponse = response;
      if (!isRetryableKtagStatus(response.status) || attempt === attempts - 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }
    await sleep(baseDelayMs * 2 ** attempt + Math.floor(random() * baseDelayMs));
  }
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error('Falha ao consultar K-TAG.');
}
