/**
 * Seed inicial de tenant + admin para desenvolvimento.
 *
 * Uso:
 *   1. Garanta credencial do Admin SDK em GOOGLE_APPLICATION_CREDENTIALS
 *      OU defina FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY no .env
 *   2. Habilite Authentication → Email/Password no console do Firebase
 *   3. tsx scripts/seed-tenants.ts [tenant-slug] [admin-email] [admin-name]
 *
 * O que cria:
 *   Firebase Auth user (email/senha) → uid
 *   /tenants/{slug}                          — metadata do tenant
 *   /tenants/{slug}/users/{uid}              — admin doc com tenantId + role=admin
 *   /tenants/{slug}/settings/config          — config vazia (admin preenche depois)
 *   customClaims = { tenantId, role, approved }
 *
 * Senha inicial: $SEED_ADMIN_PASSWORD ou 'change-me-123' como fallback.
 * O admin deve trocar a senha no primeiro login.
 *
 * IMPORTANTE: firebase-admin NÃO está em dependencies do app. Antes de rodar:
 *   npm i -D firebase-admin tsx
 */

async function loadAdmin() {
  try {
    const admin = await import('firebase-admin');
    return admin.default ?? admin;
  } catch (e) {
    console.error(
      'firebase-admin não está instalado. Rode:\n  npm i -D firebase-admin tsx\n'
    );
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

  const slug = (process.argv[2] || 'dev-tenant').toLowerCase();
  const adminEmail = (process.argv[3] || 'admin@dev-tenant.local').toLowerCase();
  const adminName = process.argv[4] || 'Admin Dev';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'change-me-123';

  const db = admin.firestore();
  const authAdmin = admin.auth();

  // 1. Tenant root
  const tenantRef = db.collection('tenants').doc(slug);
  const tenantSnap = await tenantRef.get();
  if (tenantSnap.exists) {
    console.log(`Tenant "${slug}" já existe — pulando criação do tenant root.`);
  } else {
    await tenantRef.set({
      id: slug,
      name: `Empresa ${slug}`,
      slug,
      plan: 'basic',
      active: true,
      createdAt: Date.now(),
      settings: {
        maxUsers: 10,
        features: [],
        integrations: {},
      },
    });
    console.log(`✅ Tenant criado: /tenants/${slug}`);
  }

  // 2. Settings vazias do tenant
  await tenantRef.collection('settings').doc('config').set(
    {
      language: 'pt',
      customProxyUrl: '',
      customAppName: `Empresa ${slug}`,
    },
    { merge: true }
  );

  // 2b. Espelho público do whitelabel (legível sem auth). Mantém apenas o
  // subset whitelabel; daqui pra frente, storage.saveSettings sincroniza
  // automaticamente a cada gravação no UI.
  await tenantRef.collection('public_settings').doc('whitelabel').set(
    {
      customAppName: `Empresa ${slug}`,
    },
    { merge: true }
  );

  // 3. Admin: Firebase Auth user + doc no tenant
  let userRecord;
  try {
    userRecord = await authAdmin.getUserByEmail(adminEmail);
    console.log(`Auth user "${adminEmail}" já existe — atualizando senha.`);
    await authAdmin.updateUser(userRecord.uid, { password: adminPassword });
  } catch (e: any) {
    if (e.code !== 'auth/user-not-found') throw e;
    userRecord = await authAdmin.createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
    });
    console.log(`✅ Auth user criado: ${adminEmail} (uid=${userRecord.uid})`);
  }

  const uid = userRecord.uid;

  // 4. Custom claims (necessárias para as rules)
  await authAdmin.setCustomUserClaims(uid, {
    tenantId: slug,
    role: 'admin',
    approved: true,
  });
  console.log(`✅ Custom claims setadas: tenantId=${slug}, role=admin`);

  // 5. User doc com mesmo uid
  const userRef = tenantRef.collection('users').doc(uid);
  await userRef.set(
    {
      id: uid,
      name: adminName,
      email: adminEmail,
      role: 'admin',
      status: 'approved',
      tenantId: slug,
      createdAt: Date.now(),
    },
    { merge: true }
  );
  console.log(`✅ User doc criado: /tenants/${slug}/users/${uid}`);

  console.log('\n--- DONE ---');
  console.log(`Login no dev:  http://localhost:4000?tenant=${slug}`);
  console.log(`Email:         ${adminEmail}`);
  console.log(`Senha inicial: ${adminPassword}`);
  console.log('\nLembre de trocar a senha após o primeiro login.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Seed falhou:', e);
  process.exit(1);
});
