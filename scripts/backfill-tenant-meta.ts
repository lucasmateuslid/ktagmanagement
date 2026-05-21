/**
 * Backfill do espelho público /tenants/{slug}/public_settings/meta para
 * todos os tenants existentes.
 *
 * Quando rodar:
 *   - Após criar tenants via seed-tenants.ts antigo (sem o doc meta).
 *   - Após qualquer migração que tenha esquecido de propagar name/active/plan
 *     no espelho público lido pelo SPA pré-login.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/backfill-tenant-meta.ts
 *
 * Idempotente — pode rodar quantas vezes precisar.
 */

async function loadAdmin() {
  try {
    const admin = await import('firebase-admin');
    return (admin as any).default ?? admin;
  } catch (e) {
    console.error('firebase-admin não instalado. Rode: npm i -D firebase-admin tsx');
    process.exit(1);
  }
}

async function main() {
  const admin = await loadAdmin();
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      admin.initializeApp();
    }
  }

  const db = admin.firestore();
  const snap = await db.collection('tenants').get();
  console.log(`Encontrados ${snap.size} tenant(s).`);

  let writes = 0;
  let skips = 0;
  for (const doc of snap.docs) {
    const t = doc.data() || {};
    const slug = doc.id;
    const metaRef = doc.ref.collection('public_settings').doc('meta');
    const existing = await metaRef.get();
    const patch = {
      name: t.name || slug,
      active: t.active !== false,
      plan: t.plan || 'basic',
    };

    if (existing.exists) {
      const cur = existing.data() || {};
      const same =
        cur.name === patch.name &&
        cur.active === patch.active &&
        cur.plan === patch.plan;
      if (same) {
        console.log(`  - ${slug}: meta já consistente, pulando.`);
        skips++;
        continue;
      }
    }

    await metaRef.set(patch, { merge: true });
    console.log(`  ✅ ${slug}: meta gravado (name="${patch.name}", active=${patch.active}, plan=${patch.plan}).`);
    writes++;
  }

  console.log(`\nDone. ${writes} escrito(s), ${skips} já consistente(s).`);
  process.exit(0);
}

main().catch(e => {
  console.error('Falha:', e);
  process.exit(1);
});
