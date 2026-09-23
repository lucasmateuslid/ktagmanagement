import { fetchKtagWithRetry, normalizeKtagSnapshot, type KtagSnapshot } from './ktagHistoryCapture.js';
import { decryptKtagSecret } from './ktagSecrets.js';

export class KtagConfigurationError extends Error {}
export class KtagHttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export interface KtagHistoryResult extends KtagSnapshot {
  key: string;
  sourceId?: string;
}

export { decryptKtagSecret } from './ktagSecrets.js';

export class KtagClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async getLatest(entries: Array<{ hashedKey: string; privateKey: string }>): Promise<KtagHistoryResult | null> {
    const points = await this.getHistory(entries);
    return points.reduce<KtagHistoryResult | null>((latest, point) => !latest || point.timestamp > latest.timestamp ? point : latest, null);
  }

  async getHistory(entries: Array<{ hashedKey: string; privateKey: string }>): Promise<KtagHistoryResult[]> {
    const url = process.env.KTAG_API_URL; const username = process.env.KTAG_API_USER; const password = process.env.KTAG_API_PASS;
    if (!url || !username || !password) throw new KtagConfigurationError('Integração K-TAG não configurada.');
    if (!entries.length) return [];

    const response = await fetchKtagWithRetry(() => this.fetcher(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        'User-Agent': 'Monitora360/5.1 History',
      },
      body: JSON.stringify({ hashed_keys: entries.map(item => item.hashedKey), priv_keys: entries.map(item => item.privateKey) }),
      signal: AbortSignal.timeout(Number(process.env.KTAG_REQUEST_TIMEOUT_MS) || 30_000),
    }));
    if (!response.ok) throw new KtagHttpError(response.status, `K-TAG respondeu HTTP ${response.status}.`);

    const payload = await response.json() as { results?: Array<Record<string, unknown>> };
    const knownKeys = new Set(entries.map(item => item.hashedKey));
    const fallbackKey = entries.length === 1 ? entries[0].hashedKey : '';
    return (Array.isArray(payload?.results) ? payload.results : []).flatMap(raw => {
      const key = String(raw.key || fallbackKey); const point = normalizeKtagSnapshot(raw);
      if (!key || !knownKeys.has(key) || !point) return [];
      const sourceId = raw.id === undefined || raw.id === null ? undefined : String(raw.id);
      return [{ ...point, key, sourceId }];
    });
  }
}

export const ktagClient = new KtagClient();
