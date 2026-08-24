import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Este módulo é avaliado antes do corpo de server.ts (semântica ESM), logo
// precisa carregar o projectId antes de inicializar o Firebase Admin.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
dotenvConfig({ path: resolve(repositoryRoot, '.env') });
dotenvConfig({ path: resolve(repositoryRoot, '.env.local'), override: false });

const localEmulators = process.env.LOCAL_FIREBASE_EMULATORS === 'true';
const projectId = localEmulators ? 'demo-ktag-local' : process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
if (localEmulators) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
}
const app = getApps()[0] || initializeApp(localEmulators ? { projectId } : { credential: applicationDefault(), projectId });
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
