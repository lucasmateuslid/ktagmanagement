import { recordFirestoreRead } from './firestoreReadTelemetry';

const DEFAULT_TTL_MS = 45_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const entries = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function cachedFirestoreRead<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = entries.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value as T);
  }

  const running = inFlight.get(key);
  if (running) return running as Promise<T>;

  const request = loader().then((value) => {
    const readCount = typeof value === 'object' && value !== null && 'docs' in value && Array.isArray((value as { docs?: unknown }).docs)
      ? (value as { docs: unknown[] }).docs.length
      : 1;
    recordFirestoreRead(key, readCount);
    entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });
  inFlight.set(key, request);
  void request.then(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }, () => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });
  return request;
}

export function invalidateFirestoreReadCache(keyPrefix: string): void {
  for (const key of entries.keys()) {
    if (key === keyPrefix || key.startsWith(`${keyPrefix}:`)) entries.delete(key);
  }
}
