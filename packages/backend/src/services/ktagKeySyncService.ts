import { adminDb } from './firebaseAdmin.js';
import { normalizeKtagSerial } from './ktagFleetUtils.js';
import { decryptKtagSecret, encryptKtagSecret } from './ktagSecrets.js';

export type KtagRefreshItem = {
  doc: FirebaseFirestore.QueryDocumentSnapshot;
  accessoryId: string;
  hashedAdvKey: string;
  privateKey: string;
};

export type KtagKeySyncSummary = {
  updated: number;
  unchanged: number;
  notFound: number;
  invalid: number;
};

export async function syncKtagKeysForTenant(tenantId: string, items: KtagRefreshItem[]): Promise<KtagKeySyncSummary> {
  const username = process.env.KTAG_API_USER; const password = process.env.KTAG_API_PASS;
  if (!username || !password || !items.length) return { updated: 0, unchanged: 0, notFound: 0, invalid: 0 };

  const response = await fetch(process.env.KTAG_KEYS_API_URL || 'https://api.gps308.com/tag/system/tag/device/keysByLogin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'KTagManagerPro/5.1 FleetRefresh' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload: any = await response.json().catch(() => null);
  if (!response.ok || Number(payload?.code) !== 200) throw new Error(`Sincronização K-TAG respondeu código ${payload?.code || response.status}.`);

  const remoteBySerial = new Map<string, any>();
  for (const remote of Array.isArray(payload?.data?.list) ? payload.data.list : []) {
    const serial = normalizeKtagSerial(remote?.sn);
    if (serial) remoteBySerial.set(serial, remote);
  }

  const summary: KtagKeySyncSummary = { updated: 0, unchanged: 0, notFound: 0, invalid: 0 };
  let batch = adminDb.batch(); let pending = 0;
  for (const item of items) {
    const remote = remoteBySerial.get(normalizeKtagSerial(item.accessoryId));
    if (!remote) { summary.notFound++; continue; }
    const hashedAdvKey = String(remote.hashedAdvKey || '').trim(); const privateKey = String(remote.privateKey || '').trim();
    if (!hashedAdvKey || !privateKey) { summary.invalid++; continue; }
    if (item.hashedAdvKey === hashedAdvKey && item.privateKey === privateKey) { summary.unchanged++; continue; }

    item.hashedAdvKey = hashedAdvKey; item.privateKey = privateKey;
    batch.update(item.doc.ref, {
      hashedAdvKey: encryptKtagSecret(tenantId, hashedAdvKey),
      privateKey: encryptKtagSecret(tenantId, privateKey),
      ktagKeysSyncedAt: Date.now(),
    });
    summary.updated++; pending++;
    if (pending >= 400) { await batch.commit(); batch = adminDb.batch(); pending = 0; }
  }
  if (pending) await batch.commit();
  return summary;
}

export function makeKtagRefreshItem(tenantId: string, doc: FirebaseFirestore.QueryDocumentSnapshot): KtagRefreshItem {
  return {
    doc,
    accessoryId: normalizeKtagSerial(doc.get('accessoryId')),
    hashedAdvKey: decryptKtagSecret(tenantId, doc.get('hashedAdvKey')),
    privateKey: decryptKtagSecret(tenantId, doc.get('privateKey')),
  };
}
