/**
 * Testes de Firestore Rules — Identidade Unificada + isolamento estrito.
 *
 * Pré-requisitos:
 *   npm i -D @firebase/rules-unit-testing firebase
 *   firebase emulators:start --only firestore   # em outro terminal
 *
 * Rodar:
 *   node scripts/identity-rules.test.mjs
 *
 * Cobre os itens dos checklists em UNIFIED_IDENTITY.md. Sai com código !=0 se
 * qualquer asserção falhar.
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT = 'demo-ktag-rules';
let testEnv;
let passed = 0;
let failed = 0;

async function check(name, promise) {
  try {
    await promise;
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}\n     ${e.message}`);
    failed++;
  }
}

// Helpers de contexto
const anon = () => testEnv.unauthenticatedContext().firestore();
// claims: tokenOptions viram custom claims no request.auth.token
const asUser = (uid, claims = {}) => testEnv.authenticatedContext(uid, claims).firestore();

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  await testEnv.clearFirestore();

  // ---- Seed base ----
  // Tenant A com 2 usuários: admin aprovado (uidAdminA) e pending (uidPendA).
  await seed('tenants/empresaA', { id: 'empresaA', name: 'Empresa A', active: true });
  await seed('tenants/empresaA/users/uidAdminA', { id: 'uidAdminA', tenantId: 'empresaA', role: 'admin', status: 'approved', email: 'a@a.com' });
  await seed('tenants/empresaA/users/uidPendA', { id: 'uidPendA', tenantId: 'empresaA', role: 'user', status: 'pending', email: 'p@a.com' });
  await seed('tenants/empresaA/tags/t1', { id: 't1' });
  await seed('tenants/empresaB', { id: 'empresaB', name: 'Empresa B', active: true });
  await seed('tenants/empresaB/tags/t2', { id: 't2' });
  await seed('tenants/empresaB/users/uidMultiUser', { id: 'uidMultiUser', tenantId: 'empresaB', role: 'user', status: 'approved', email: 'm@x.com' });
  await seed('identities/uidAdminA', { uid: 'uidAdminA', email: 'a@a.com', isGlobalAdmin: false });
  await seed('identities/uidAdminA/memberships/empresaA', { uid: 'uidAdminA', tenantId: 'empresaA', role: 'admin', status: 'approved' });
  await seed('system_admins/uidSuper', { uid: 'uidSuper' });

  console.log('\n=== SEGURANÇA ===');

  // pending NÃO acessa dados de domínio (regressão do bug hasTenantDoc)
  await check('pending NÃO lê tags (sem claim, doc pending)',
    assertFails(getDoc(doc(asUser('uidPendA'), 'tenants/empresaA/tags/t1'))));

  // pending lê o PRÓPRIO doc
  await check('pending lê o próprio user doc',
    assertSucceeds(getDoc(doc(asUser('uidPendA'), 'tenants/empresaA/users/uidPendA'))));

  // membro aprovado via CLAIM nova
  await check('aprovado via claim tn lê tags',
    assertSucceeds(getDoc(doc(asUser('uidAdminA', { tn: { empresaA: 'admin' } }), 'tenants/empresaA/tags/t1'))));

  // membro aprovado via FALLBACK por doc (sem claim)
  await check('aprovado via doc fallback lê tags',
    assertSucceeds(getDoc(doc(asUser('uidAdminA'), 'tenants/empresaA/tags/t1'))));

  // claim legada ainda funciona (compat de migração)
  await check('claim legada {tenantId,approved} lê tags',
    assertSucceeds(getDoc(doc(asUser('uidAdminA', { tenantId: 'empresaA', role: 'admin', approved: true }), 'tenants/empresaA/tags/t1'))));

  // self-register: role inválido negado
  await check('auto-registro com role!=user é NEGADO',
    assertFails(setDoc(doc(asUser('novo'), 'tenants/empresaA/users/novo'), { tenantId: 'empresaA', role: 'admin', status: 'pending' })));
  await check('auto-registro pending/user é PERMITIDO',
    assertSucceeds(setDoc(doc(asUser('novo'), 'tenants/empresaA/users/novo'), { tenantId: 'empresaA', role: 'user', status: 'pending' })));

  // identidade: só o dono lê
  await check('lê a PRÓPRIA identidade',
    assertSucceeds(getDoc(doc(asUser('uidAdminA'), 'identities/uidAdminA'))));
  await check('NÃO lê identidade de outro uid',
    assertFails(getDoc(doc(asUser('intruso'), 'identities/uidAdminA'))));
  await check('cliente NÃO escreve /identities (Admin SDK only)',
    assertFails(setDoc(doc(asUser('uidAdminA'), 'identities/uidAdminA'), { hacked: true })));

  console.log('\n=== ISOLAMENTO MULTI-TENANT ===');

  // cross-tenant negado
  await check('membro de A NÃO lê tags de B',
    assertFails(getDoc(doc(asUser('uidAdminA', { tn: { empresaA: 'admin' } }), 'tenants/empresaB/tags/t2'))));

  // multi-tenant: claim com A e B acessa os dois
  await check('claim tn {A,B} lê tags de A',
    assertSucceeds(getDoc(doc(asUser('uidMultiUser', { tn: { empresaA: 'user', empresaB: 'user' } }), 'tenants/empresaA/tags/t1'))));
  await check('claim tn {A,B} lê tags de B',
    assertSucceeds(getDoc(doc(asUser('uidMultiUser', { tn: { empresaA: 'user', empresaB: 'user' } }), 'tenants/empresaB/tags/t2'))));

  // ISOLAMENTO ESTRITO: super admin NÃO lê dados operacionais via cliente
  await check('super admin (claim) NÃO lê tags de tenant',
    assertFails(getDoc(doc(asUser('uidSuper', { superadmin: true }), 'tenants/empresaA/tags/t1'))));
  await check('super admin (claim) NÃO lê users de tenant',
    assertFails(getDoc(doc(asUser('uidSuper', { superadmin: true }), 'tenants/empresaA/users/uidAdminA'))));

  // super admin LÊ o root doc (control plane)
  await check('super admin lê /tenants/{tid} root doc',
    assertSucceeds(getDoc(doc(asUser('uidSuper', { superadmin: true }), 'tenants/empresaA'))));

  // super admin pelo fallback de doc também (sem claim)
  await check('super admin via doc system_admins lê root doc',
    assertSucceeds(getDoc(doc(asUser('uidSuper'), 'tenants/empresaA'))));

  console.log(`\n=== RESULTADO: ${passed} ok, ${failed} falhas ===\n`);
  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Erro fatal nos testes:', e);
  process.exit(1);
});
