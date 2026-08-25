/**
 * Preenche o índice HMAC de pesquisa de veículos. Dry-run por padrão.
 * Uso:
 *   npx tsx scripts/backfill-vehicle-search.ts --tenant=acme
 *   npx tsx scripts/backfill-vehicle-search.ts --tenant=acme --apply
 *   npx tsx scripts/backfill-vehicle-search.ts --all --apply
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildVehicleSearchNgrams, decryptTenantValue } from '../packages/backend/src/services/vehicleSearch.js';

const apply = process.argv.includes('--apply');
const all = process.argv.includes('--all');
const tenantArg = process.argv.find(value => value.startsWith('--tenant='))?.slice('--tenant='.length);
if (!all && !tenantArg) throw new Error('Informe --tenant=<tenantId> ou --all.');

const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
const db = getFirestore(app);
const tenantIds = all
  ? (await db.collection('tenants').get()).docs.map(doc => doc.id)
  : [tenantArg!];

for (const tenantId of tenantIds) {
  const [vehiclesSnapshot, clientsSnapshot] = await Promise.all([
    db.collection(`tenants/${tenantId}/vehicles`).get(),
    db.collection(`tenants/${tenantId}/clients`).get(),
  ]);
  const clients = new Map(clientsSnapshot.docs.map(doc => [doc.id, decryptTenantValue(tenantId, doc.get('name'))]));
  const writer = apply ? db.bulkWriter() : null;
  let changed = 0;
  for (const vehicle of vehiclesSnapshot.docs) {
    const searchNgrams = buildVehicleSearchNgrams(tenantId, [
      decryptTenantValue(tenantId, vehicle.get('plate')),
      vehicle.get('model'),
      clients.get(String(vehicle.get('clientId') || '')) || '',
    ]);
    const current = vehicle.get('searchNgrams');
    if (Array.isArray(current) && current.length === searchNgrams.length && current.every((value, index) => value === searchNgrams[index])) continue;
    changed += 1;
    if (writer) writer.update(vehicle.ref, { searchNgrams });
  }
  if (writer) await writer.close();
  console.info(JSON.stringify({ tenantId, dryRun: !apply, vehicles: vehiclesSnapshot.size, clients: clientsSnapshot.size, changed }));
}
