/**
 * MIGRAÇÃO — Identidade Unificada (idempotente)
 *
 * Reconstrói a camada de identidade a partir das fontes da verdade existentes:
 *   /tenants/*\/users/*   → /identities/{uid} + /identities/{uid}/memberships/{tid}
 *   /system_admins/*      → /identities/{uid}.isGlobalAdmin = true
 * e re-minta as custom claims na NOVA shape:
 *   { superadmin?: true, tn?: { [tid]: role }, tnBig?: true }
 *
 * Uso:
 *   tsx scripts/migrate-identities.ts            # aplica
 *   tsx scripts/migrate-identities.ts --dry-run  # só relata, não escreve
 *
 * Pré-requisitos: credencial Admin SDK em GOOGLE_APPLICATION_CREDENTIALS
 * ou nas envs FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.
 *
 * Seguro rodar várias vezes. Rode DEPOIS de fazer deploy das novas rules + das
 * Cloud Functions (que mantêm a camada de identidade daí em diante).
 */

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_CLAIM_BYTES = 900;

async function loadAdmin() {
  try {
    const admin = await import('firebase-admin');
    return (admin as any).default ?? admin;
  } catch {
    console.error('firebase-admin não instalado. Rode:\n  npm i -D firebase-admin tsx\n');
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
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    } else {
      admin.initializeApp();
    }
  }

  const db = admin.firestore();
  const auth = admin.auth();

  console.log(`\n=== Migração de Identidades ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // 1) Espelha memberships a partir dos user docs de cada tenant.
  const tenantsSnap = await db.collection('tenants').get();
  const touched = new Set<string>();
  let membershipCount = 0;

  for (const t of tenantsSnap.docs) {
    const tenantId = t.id;
    const usersSnap = await t.ref.collection('users').get();
    for (const u of usersSnap.docs) {
      const data = u.data();
      const uid = u.id;
      touched.add(uid);
      membershipCount++;
      const email = String(data.email || '').toLowerCase();

      if (!DRY_RUN) {
        await db.collection('identities').doc(uid).set(
          { uid, email, updatedAt: Date.now() },
          { merge: true }
        );
        await db.collection('identities').doc(uid).collection('memberships').doc(tenantId).set(
          {
            uid,
            tenantId,
            role: data.role || 'user',
            status: data.status || 'pending',
            customRoleId: data.customRoleId || null,
            email,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
      console.log(`  membership ${email || uid} @ ${tenantId} (${data.role || 'user'}/${data.status || 'pending'})`);
    }
  }

  // 2) system_admins → garante identidade (pode não ter membership de tenant).
  const adminsSnap = await db.collection('system_admins').get();
  adminsSnap.forEach((d: any) => touched.add(d.id));

  // 3) Recomputa identidade + claims para cada uid.
  let claimsSet = 0;
  for (const uid of touched) {
    const membersSnap = await db.collection('identities').doc(uid).collection('memberships').get();
    const tn: Record<string, string> = {};
    membersSnap.forEach((d: any) => {
      const m = d.data();
      if (m.status === 'approved') tn[d.id] = m.role || 'user';
    });
    const isGlobal = (await db.collection('system_admins').doc(uid).get()).exists;

    const claims: Record<string, unknown> = {};
    if (isGlobal) claims.superadmin = true;
    const withTn = { ...claims, tn };
    if (Buffer.byteLength(JSON.stringify(withTn), 'utf8') <= MAX_CLAIM_BYTES) {
      if (Object.keys(tn).length > 0) claims.tn = tn;
    } else {
      claims.tnBig = true;
    }

    if (!DRY_RUN) {
      try {
        await auth.setCustomUserClaims(uid, claims);
        await db.collection('identities').doc(uid).set(
          { uid, isGlobalAdmin: !!isGlobal, updatedAt: Date.now() },
          { merge: true }
        );
        claimsSet++;
      } catch (e: any) {
        // uid sem conta Auth (doc órfão) — apenas registra.
        console.warn(`  ! claims falhou para ${uid}: ${e.message}`);
      }
    }
    console.log(`  identity ${uid} → claims ${JSON.stringify(claims)}`);
  }

  console.log(`\nResumo: ${touched.size} identidades, ${membershipCount} memberships, ${claimsSet} claims atualizadas.`);
  console.log(DRY_RUN ? '\n(DRY RUN — nada foi escrito.)\n' : '\n✅ Migração concluída.\n');
  console.log('Lembre os usuários de recarregar a app (força refresh do token p/ puxar as novas claims).');
  process.exit(0);
}

main().catch((e) => {
  console.error('Falha na migração:', e);
  process.exit(1);
});
