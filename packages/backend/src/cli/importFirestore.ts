import { DocumentReference, FieldPath, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../services/firebaseAdmin.js';
import { closePostgres, postgres } from '../services/postgres.js';

const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify');
if (apply && verify) throw new Error('Use --apply ou --verify em execuções separadas.');
const tenant = process.argv.find(arg => arg.startsWith('--tenant='))?.slice('--tenant='.length);
if (tenant && !/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(tenant)) throw new Error('tenant inválido');

function encode(value: unknown): unknown {
  if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw new Error('Número inteiro fora da faixa exata do JavaScript; importar por representação bruta do Firestore.');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return { __firestoreType: 'Double', value: String(value) };
  if (typeof value === 'number' && Object.is(value, -0)) return { __firestoreType: 'Double', value: '-0' };
  if (value instanceof Timestamp) return { __firestoreType: 'Timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { __firestoreType: 'GeoPoint', latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { __firestoreType: 'DocumentReference', path: value.path };
  if (value && typeof value === 'object' && value.constructor?.name === 'VectorValue' && 'toArray' in value) {
    return { __firestoreType: 'Vector', values: (value as { toArray: () => number[] }).toArray().map(encode) };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __firestoreType: 'Bytes', base64: Buffer.from(value).toString('base64') };
  if (Array.isArray(value)) return value.map(encode);
  if (value === undefined || typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`Tipo Firestore não suportado no importador: ${typeof value}`);
  }
  if (value && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error(`Classe Firestore não suportada no importador: ${value.constructor?.name || 'desconhecida'}`);
    }
    const fields = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    return Object.hasOwn(value, '__firestoreType') ? { __firestoreType: 'Map', fields } : fields;
  }
  return value;
}

const counts = new Map<string, number>();
let documents = 0;
let checked = 0;
let different = 0;
const mismatches: string[] = [];
const exactTime = (value: Timestamp | undefined) => value ? `${value.seconds}.${String(value.nanoseconds).padStart(9, '0')}` : null;

async function save(snapshot: FirebaseFirestore.DocumentSnapshot) {
  if (!snapshot.exists) return;
  const path = snapshot.ref.path;
  const segments = path.split('/');
  const tenantId = segments[0] === 'tenants' ? segments[1] : null;
  const collection = segments.filter((_, index) => index % 2 === 0).join('/');
  counts.set(collection, (counts.get(collection) || 0) + 1);
  documents++;
  const data = snapshot.data() || {};
  let payload: string;
  try { payload = JSON.stringify(encode(data)); }
  catch (error) { throw new Error(`Não foi possível codificar ${path}: ${String(error)}`); }
  if (verify) {
    const result = await postgres().query<{ matches: boolean }>(
      `SELECT payload = $2::jsonb
        AND source_create_time IS NOT DISTINCT FROM $3::text
        AND source_update_time IS NOT DISTINCT FROM $4::text AS matches
       FROM firestore_import WHERE path = $1`,
      [path, payload, exactTime(snapshot.createTime), exactTime(snapshot.updateTime)],
    );
    checked++;
    if (!result.rows[0]?.matches) {
      different++;
      if (mismatches.length < 20) mismatches.push(path);
    }
  }
  if (apply) {
    await postgres().query(
      `INSERT INTO firestore_import (path, tenant_id, payload, source_create_time, source_update_time, imported_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, now())
       ON CONFLICT (path) DO UPDATE SET tenant_id = EXCLUDED.tenant_id,
         payload = EXCLUDED.payload, source_create_time = EXCLUDED.source_create_time,
         source_update_time = EXCLUDED.source_update_time, imported_at = EXCLUDED.imported_at`,
      [path, tenantId, payload, exactTime(snapshot.createTime), exactTime(snapshot.updateTime)],
    );
    if (segments[0] === 'tenants' && segments.length === 2) {
      const features = Array.isArray(data.settings?.features) ? data.settings.features.map(String) : [];
      await postgres().query(
        `INSERT INTO tenants (id, active, enabled_modules, payload) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (id) DO UPDATE SET active = EXCLUDED.active,
           enabled_modules = EXCLUDED.enabled_modules, payload = EXCLUDED.payload`,
        [snapshot.id, data.active !== false, features, JSON.stringify(encode(data))],
      );
    }
    if (segments[0] === 'tenants' && segments[2] === 'users' && segments.length === 4) {
      await postgres().query(
        `INSERT INTO tenant_users (tenant_id, uid, status, role, client_id, custom_role_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (tenant_id, uid) DO UPDATE SET status = EXCLUDED.status,
           role = EXCLUDED.role, client_id = EXCLUDED.client_id,
           custom_role_id = EXCLUDED.custom_role_id, payload = EXCLUDED.payload`,
        [tenantId, snapshot.id, String(data.status || ''), String(data.role || ''), data.clientId ? String(data.clientId) : null,
          data.customRoleId ? String(data.customRoleId) : null, JSON.stringify(encode(data))],
      );
    }
    if (segments[0] === 'tenants' && segments[2] === 'custom_roles' && segments.length === 4) {
      await postgres().query(
        `INSERT INTO custom_roles (tenant_id, id, permissions, payload) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (tenant_id, id) DO UPDATE SET permissions = EXCLUDED.permissions, payload = EXCLUDED.payload`,
        [tenantId, snapshot.id, Array.isArray(data.permissions) ? data.permissions.map(String) : [], JSON.stringify(encode(data))],
      );
    }
    if (segments[0] === 'system_admins' && segments.length === 2) {
      await postgres().query(
        `INSERT INTO system_admins (uid, payload) VALUES ($1, $2::jsonb)
         ON CONFLICT (uid) DO UPDATE SET payload = EXCLUDED.payload`,
        [snapshot.id, JSON.stringify(encode(data))],
      );
    }
    if (segments[0] === 'tenants' && segments[2] === 'tag_history' && segments.length === 4) {
      const timestamp = Number(data.timestamp);
      const latitude = Number(data.lat ?? data.latitude);
      const longitude = Number(data.lon ?? data.longitude);
      const tagId = String(data.tagId || '');
      if (tagId && Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        const savedAt = data.savedAt instanceof Timestamp ? data.savedAt.toMillis() : Number(data.savedAt) || timestamp;
        await postgres().query(
          `INSERT INTO tag_history (tenant_id, id, tag_id, vehicle_id, captured_at, latitude, longitude, payload, saved_at)
           VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7, $8::jsonb, to_timestamp($9 / 1000.0))
           ON CONFLICT (tenant_id, id) DO UPDATE SET tag_id = EXCLUDED.tag_id,
             vehicle_id = EXCLUDED.vehicle_id, captured_at = EXCLUDED.captured_at,
             latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
             payload = EXCLUDED.payload, saved_at = EXCLUDED.saved_at`,
          [tenantId, snapshot.id, tagId, data.vehicleIdAtCapture || data.vehicleId || null, timestamp, latitude, longitude,
            JSON.stringify(encode(data)), savedAt],
        );
      }
    }
  }
}

async function scanCollection(collection: FirebaseFirestore.CollectionReference): Promise<void> {
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  const existingIds = new Set<string>();
  do {
    let query = collection.orderBy(FieldPath.documentId()).limit(250);
    if (last) query = query.startAfter(last);
    const batch = await query.get();
    for (const doc of batch.docs) {
      existingIds.add(doc.id);
      await save(doc);
      for (const child of await doc.ref.listCollections()) await scanCollection(child);
    }
    last = batch.docs.at(-1);
    if (batch.size < 250) break;
  } while (last);
  // Firestore permite subcoleções sob pais inexistentes. Queries não retornam
  // esses pais; listDocuments os revela para que seus filhos sejam visitados.
  for (const ref of await collection.listDocuments()) {
    if (existingIds.has(ref.id)) continue;
    for (const child of await ref.listCollections()) await scanCollection(child);
  }
}

try {
  if (apply || verify) await postgres().query('SELECT 1 FROM firestore_import LIMIT 1');
  if (tenant) {
    const root = adminDb.doc(`tenants/${tenant}`);
    const doc = await root.get();
    const children = await root.listCollections();
    if (!doc.exists && children.length === 0) throw new Error(`Tenant ${tenant} não encontrado`);
    if (doc.exists) await save(doc);
    for (const child of children) await scanCollection(child);
  } else {
    for (const collection of await adminDb.listCollections()) await scanCollection(collection);
  }
  const persisted = apply
    || verify
    ? Number((await postgres().query(
      tenant ? 'SELECT count(*) AS count FROM firestore_import WHERE tenant_id = $1' : 'SELECT count(*) AS count FROM firestore_import',
      tenant ? [tenant] : [],
    )).rows[0].count)
    : null;
  console.log(JSON.stringify({ mode: verify ? 'verify' : apply ? 'apply' : 'count-only', tenant: tenant || 'all', documents, persisted,
    countMatches: persisted === null ? null : persisted === documents, checked: verify ? checked : null,
    different: verify ? different : null, sampleMismatches: mismatches, collections: Object.fromEntries(counts) }, null, 2));
  if (persisted !== null && (persisted !== documents || different > 0)) process.exitCode = 2;
} finally {
  await closePostgres();
}
