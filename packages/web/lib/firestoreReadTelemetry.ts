import { activeTenant } from '../services/activeTenant';
import { authenticatedFetch } from '../services/authenticatedFetch';

interface ReadMetric {
  collection: string;
  source: string;
  reads: number;
}

const metrics = new Map<string, ReadMetric>();
const FLUSH_INTERVAL_MS = 5 * 60_000;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;

function collectionFromCacheKey(key: string): string {
  const path = key.replace(/^(collection|doc):/, '');
  const segments = path.split('/');
  return segments[segments.length - 2] || segments[segments.length - 1] || 'unknown';
}

function sourceFromCacheKey(key: string): string {
  return key.startsWith('collection:') ? 'collection-read' : 'document-read';
}

export function recordFirestoreRead(key: string, readCount: number): void {
  if (!activeTenant.isReady() || readCount <= 0) return;
  const collection = collectionFromCacheKey(key);
  const source = sourceFromCacheKey(key);
  const metricKey = `${collection}:${source}`;
  const current = metrics.get(metricKey);
  metrics.set(metricKey, {
    collection,
    source,
    reads: (current?.reads || 0) + readCount,
  });
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flushFirestoreReadTelemetry();
  }, FLUSH_INTERVAL_MS);
}

export async function flushFirestoreReadTelemetry(): Promise<void> {
  if (flushing || metrics.size === 0 || !activeTenant.isReady()) return;
  flushing = true;
  const batch = [...metrics.values()];
  metrics.clear();
  try {
    const response = await authenticatedFetch('/api/telemetry/firestore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics: batch }),
    });
    if (!response.ok) throw new Error(`Telemetry rejected (${response.status})`);
  } catch (error) {
    for (const metric of batch) {
      const key = `${metric.collection}:${metric.source}`;
      const current = metrics.get(key);
      metrics.set(key, { ...metric, reads: metric.reads + (current?.reads || 0) });
    }
    console.warn('Firestore read telemetry flush failed:', error);
    scheduleFlush();
  } finally {
    flushing = false;
  }
}
