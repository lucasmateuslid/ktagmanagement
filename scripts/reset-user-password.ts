/**
 * Reset da senha de um usuário existente no Firebase Auth.
 *
 * Uso:
 *   tsx scripts/reset-user-password.ts <email> <nova-senha>
 *
 * Não cria usuário, não mexe em claims/docs — só atualiza a senha do uid
 * resolvido pelo email. Útil quando esquece a senha do super admin local.
 *
 * Credenciais Admin SDK vêm de FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL
 * + FIREBASE_PRIVATE_KEY no .env (mesmo padrão do seed-tenants.ts).
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
  const email = (process.argv[2] || '').toLowerCase().trim();
  const newPassword = process.argv[3] || '';

  if (!email || !newPassword) {
    console.error('Uso: tsx scripts/reset-user-password.ts <email> <nova-senha>');
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.error('Senha deve ter no mínimo 6 caracteres.');
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
    process.exit(1);
  }

  await admin.auth().updateUser(userRecord.uid, { password: newPassword });
  console.log(`✅ Senha atualizada para ${email} (uid=${userRecord.uid}).`);

  // Diagnóstico útil: informa se o usuário tem doc em /system_admins
  // e quais customClaims estão setadas no token (sem expor a senha).
  const adminDoc = await admin.firestore().collection('system_admins').doc(userRecord.uid).get();
  const claims = (userRecord.customClaims as Record<string, any>) || {};
  console.log(`\nDiagnóstico:`);
  console.log(`  /system_admins/${userRecord.uid}: ${adminDoc.exists ? 'EXISTE' : 'AUSENTE'}`);
  console.log(`  customClaims.superadmin: ${claims.superadmin === true ? 'true' : '(não setada)'}`);
  console.log(`  customClaims.tenantId: ${claims.tenantId || '(não setada)'}`);
  console.log(`  customClaims.role: ${claims.role || '(não setada)'}`);

  process.exit(0);
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
