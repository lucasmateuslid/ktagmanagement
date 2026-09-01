import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { fetchKtagWithRetry, normalizeKtagSnapshot, type KtagSnapshot } from './ktagHistoryCapture.js';

export class KtagConfigurationError extends Error {}
export class KtagHttpError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export interface KtagHistoryResult extends KtagSnapshot {
  key: string;
  sourceId?: string;
}

export const decryptKtagSecret = (tenantId: string, value: unknown) => {
  const text = String(value || '');
  if (text.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(text)) return text;
  try {
    const raw = Buffer.from(text, 'base64');
    const iv = raw.subarray(0, 12); const encrypted = raw.subarray(12, -16); const authTag = raw.subarray(-16);
    const key = pbkdf2Sync(`ktag-enterprise-master-key-${tenantId}-v3`, 'ktag-enterprise-salt-2025', 100_000, 32, 'sha256');
    const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return text; }
};

export class KtagClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

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
