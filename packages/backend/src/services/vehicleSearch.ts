import { createCipheriv, createDecipheriv, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

const SEARCH_INDEX_FALLBACK = 'ktag-search-index-v1';
const tenantKeys = new Map<string, Buffer>();

export const normalizeVehicleSearch = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9 ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const hashVehicleSearch = (tenantId: string, value: string) => createHmac(
  'sha256',
  process.env.SEARCH_INDEX_KEY || SEARCH_INDEX_FALLBACK,
).update(`${tenantId}:${value}`).digest('hex');

const grams = (value: unknown) => {
  const normalized = normalizeVehicleSearch(value);
  const result = new Set<string>();
  for (let size = 1; size <= Math.min(3, normalized.length); size += 1) {
    for (let offset = 0; offset <= normalized.length - size; offset += 1) {
      result.add(normalized.slice(offset, offset + size));
    }
  }
  return result;
};

export const buildVehicleSearchNgrams = (tenantId: string, values: unknown[]) => [
  ...new Set(values.flatMap(value => [...grams(value)]).map(value => hashVehicleSearch(tenantId, value))),
];

export const vehicleSearchCandidateToken = (tenantId: string, search: unknown) => {
  const normalized = normalizeVehicleSearch(search);
  if (!normalized) return null;
  return hashVehicleSearch(tenantId, normalized.slice(0, Math.min(3, normalized.length)));
};

const tenantKey = (tenantId: string) => {
  const cached = tenantKeys.get(tenantId);
  if (cached) return cached;
  const key = pbkdf2Sync(
    `ktag-enterprise-master-key-${tenantId}-v3`,
    'ktag-enterprise-salt-2025',
    100_000,
    32,
    'sha256',
  );
  tenantKeys.set(tenantId, key);
  return key;
};

export function decryptTenantValue(tenantId: string, value: unknown): string {
  const text = String(value || '');
  if (text.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(text)) return text;
  try {
    const raw = Buffer.from(text, 'base64');
    const iv = raw.subarray(0, 12); const encrypted = raw.subarray(12, -16); const tag = raw.subarray(-16);
    const decipher = createDecipheriv('aes-256-gcm', tenantKey(tenantId), iv); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return text; }
}

export function encryptTenantValue(tenantId: string, value: unknown): string {
  const text = String(value || '');
  if (!text) return text;
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', tenantKey(tenantId), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');
}
