import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const projectId = 'demo-ktag-local';
const app = initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const accounts = [
  { uid: 'superadmin-local', email: 'superadmin@local.test', role: 'admin', claims: { superadmin: true } },
  { uid: 'admin-a', email: 'admin.a@local.test', role: 'admin', tenantId: 'empresa-a' },
  { uid: 'operador-a', email: 'operador.a@local.test', role: 'user', tenantId: 'empresa-a', customRoleId: 'operador-rastreadores' },
  { uid: 'cliente-a', email: 'cliente.a@local.test', role: 'client', tenantId: 'empresa-a', clientId: 'cliente-a' },
  { uid: 'admin-b', email: 'admin.b@local.test', role: 'admin', tenantId: 'empresa-b' },
];

for (const account of accounts) {
  await auth.createUser({ uid: account.uid, email: account.email, password: 'Local123!', emailVerified: true }).catch(async error => {
    if (error.code !== 'auth/uid-already-exists') throw error;
    await auth.updateUser(account.uid, { email: account.email, password: 'Local123!', emailVerified: true });
  });
  await auth.setCustomUserClaims(account.uid, account.claims || { tn: { [account.tenantId]: account.role } });
}

const batch = db.batch();
const put = (path, data) => batch.set(db.doc(path), data, { merge: true });
put('system_admins/superadmin-local', { uid: 'superadmin-local', email: 'superadmin@local.test' });
put('tenants/empresa-a', { id: 'empresa-a', slug: 'empresa-a', name: 'Empresa A', active: true, settings: { features: ['trackers', 'scheduling', 'shipments'] } });
put('tenants/empresa-b', { id: 'empresa-b', slug: 'empresa-b', name: 'Empresa B', active: true, settings: { features: [] } });
for (const account of accounts.filter(item => item.tenantId)) {
  put(`tenants/${account.tenantId}/users/${account.uid}`, { id: account.uid, email: account.email, tenantId: account.tenantId, role: account.role, status: 'approved', clientId: account.clientId || null, customRoleId: account.customRoleId || null });
  put(`identities/${account.uid}`, { uid: account.uid, email: account.email, isGlobalAdmin: false });
  put(`identities/${account.uid}/memberships/${account.tenantId}`, { uid: account.uid, tenantId: account.tenantId, role: account.role, status: 'approved' });
}
put('tenants/empresa-a/custom_roles/operador-rastreadores', { name: 'Operador de rastreadores', permissions: ['ROUTE_ASSETS'] });
put('tenants/empresa-a/clients/cliente-a', { id: 'cliente-a', name: 'Cliente A' });
put('tenants/empresa-a/clients/cliente-b', { id: 'cliente-b', name: 'Cliente B' });
put('tenants/empresa-a/vehicles/veiculo-a', { id: 'veiculo-a', clientId: 'cliente-a', plate: 'AAA0A00' });
put('tenants/empresa-a/vehicles/veiculo-b', { id: 'veiculo-b', clientId: 'cliente-b', plate: 'BBB0B00' });
put('tenants/empresa-a/sim_cards/chip-a', { id: 'chip-a', iccid: '8955000000000000001', phoneNumber: '81999990001', status: 'in_stock' });
put('tenants/empresa-b/sim_cards/chip-b', { id: 'chip-b', iccid: '8955000000000000002', phoneNumber: '81999990002', status: 'in_stock' });
await batch.commit();

console.log('Fixtures locais carregadas. Senha de todas as contas: Local123!');
