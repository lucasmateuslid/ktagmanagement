import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';

const keyForTenant = (tenantId: string) => pbkdf2Sync(
  `ktag-enterprise-master-key-${tenantId}-v3`,
  'ktag-enterprise-salt-2025',
  100_000,
  32,
  'sha256',
);

export const decryptKtagSecret = (tenantId: string, value: unknown) => {
  const text = String(value || '');
  if (text.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(text)) return text;
  try {
    const raw = Buffer.from(text, 'base64');
    const iv = raw.subarray(0, 12); const encrypted = raw.subarray(12, -16); const authTag = raw.subarray(-16);
    const decipher = createDecipheriv('aes-256-gcm', keyForTenant(tenantId), iv); decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return text;
  }
};

export const encryptKtagSecret = (tenantId: string, value: unknown) => {
  const text = String(value || '');
  if (!text) return text;
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', keyForTenant(tenantId), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');
};
