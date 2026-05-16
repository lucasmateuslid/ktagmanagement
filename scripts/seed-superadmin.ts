/**
 * Promove um usuário existente a super admin da plataforma.
 *
 * Uso:
 *   tsx scripts/seed-superadmin.ts <email>
 *
 * Pré-requisitos:
 *   - O usuário JÁ precisa existir no Firebase Auth.
 *     (Crie via scripts/seed-tenants.ts ou pelo Console.)
 *   - Credencial Admin SDK em GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_*.
 *
 * O que faz:
 *   - Resolve o uid pelo email
 *   - Cria/atualiza /system_admins/{uid}
 *   - Adiciona customClaim { superadmin: true }
 */

async function loadAdmin() {
  try {
    const admin = await import('firebase-admin');
    return admin.default ?? admin;
  } catch (e) {
    console.error('firebase-admin não está instalado. Rode:\n  npm i -D firebase-admin tsx\n');
    process.exit(1);
  }
}

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!email) {
    console.error('Uso: tsx scripts/seed-superadmin.ts <email>');
    process.exit(1);
  }

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

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e: any) {
    console.error(`Usuário ${email} não encontrado no Firebase Auth.`);
    console.error('Crie primeiro com seed-tenants.ts ou pelo Console do Firebase.');
    process.exit(1);
  }

  const uid = userRecord.uid;

  await admin.firestore().collection('system_admins').doc(uid).set({
    uid,
    addedAt: Date.now(),
    addedBy: 'SEED_SCRIPT',
  }, { merge: true });
  console.log(`✅ Doc /system_admins/${uid} criado.`);

  const existing = userRecord.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, { ...existing, superadmin: true });
  console.log(`✅ customClaim superadmin: true setada.`);

  console.log('\nDONE.');
  console.log(`Acesse o painel:`);
  console.log(`  Dev:  http://localhost:5173?tenant=admin`);
  console.log(`  Prod: https://admin.<seu-dominio>`);
  console.log(`Login: ${email}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
