/**
 * Espelho SERVER-SIDE (Node webcrypto) da criptografia do cliente
 * (packages/web/services/encryption.ts): AES-GCM 256, chave derivada via PBKDF2
 * a partir do tenantId. Byte-compatível com o cliente — logo o poller e o
 * syncKtagKeys leem/gravam as chaves das tags no MESMO formato que a UI grava.
 *
 * Por que existe: o cliente cifra hashedAdvKey/privateKey ao salvar a tag
 * (encryption.initialize(tenantId)). O poller lia esses campos CRUS e mandava
 * ciphertext para a API — quebrando o rastreio de tags criadas pela UI. Este
 * módulo decifra antes de chamar a API.
 *
 * decrypt() faz passthrough SEGURO para texto plano (mesma heurística do cliente):
 * valor curto / não-base64 → devolve original; GCM falhou → devolve original.
 * Assim funciona para tags cifradas (UI) E antigas em texto plano, sem migração.
 */
const { webcrypto } = require('node:crypto');
const subtle = webcrypto.subtle;

const _keyCache = new Map(); // tenantId -> CryptoKey (PBKDF2 é caro; memoiza)

async function deriveKey(tenantId) {
  if (_keyCache.has(tenantId)) return _keyCache.get(tenantId);
  const enc = new TextEncoder();
  const composedSeed = `ktag-enterprise-master-key-${tenantId}-v3`;
  const material = await subtle.importKey('raw', enc.encode(composedSeed), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ktag-enterprise-salt-2025'), iterations: 100000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  _keyCache.set(tenantId, key);
  return key;
}

/** Decifra um valor (base64 iv||ciphertext||tag). Passthrough se não for cifrado. */
async function decrypt(tenantId, base64) {
  if (!base64 || base64.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(base64)) return base64;
  try {
    const key = await deriveKey(tenantId);
    const combined = Buffer.from(base64, 'base64');
    const iv = combined.subarray(0, 12);
    const data = combined.subarray(12);
    const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return Buffer.from(decrypted).toString('utf8');
  } catch {
    return base64; // não estava cifrado (ou chave mudou) — mantém original
  }
}

/** Cifra um valor no mesmo layout do cliente (iv(12) || ciphertext||tag, base64). */
async function encrypt(tenantId, text) {
  if (!text) return text;
  try {
    const key = await deriveKey(tenantId);
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + ct.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ct), iv.length);
    return Buffer.from(combined).toString('base64');
  } catch {
    return text;
  }
}

module.exports = { decrypt, encrypt };
