import { initializeApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFunctions, Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let functions: Functions | null = null;

try {
  app = initializeApp(firebaseConfig);

  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  });

  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore Persistence: Múltiplas abas detectadas. Cache ativo apenas na aba principal.");
    } else if (err.code === 'unimplemented') {
      console.warn("Firestore Persistence: Este navegador não suporta armazenamento offline.");
    }
  });

  auth = getAuth(app);
  // Persistência local — mantém o usuário logado entre abas/refresh; alinha com
  // o comportamento offline-first do app.
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Firebase Auth persistence fallback (memory):", err?.message);
  });

  functions = getFunctions(app);

  console.log("Firebase initialized: Auth + Firestore (Long Polling + Offline) + Functions.");
} catch (e: any) {
  console.error("Firebase App initialization error:", e);
  console.warn("Falling back to LocalStorage (Offline Mode Only)");
  db = null;
  auth = null;
  functions = null;
}

export { app, db, auth, functions };
