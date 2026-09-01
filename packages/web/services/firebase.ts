import { initializeApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, Auth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';

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
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  auth = getAuth(app);
  const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
  if (useEmulators) {
    const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
    const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
    const authPort = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099);
    connectFirestoreEmulator(db, emulatorHost, firestorePort);
    connectAuthEmulator(auth, `http://${emulatorHost}:${authPort}`, { disableWarnings: true });
  }
  // Persistência local — mantém o usuário logado entre abas/refresh; alinha com
  // o comportamento offline-first do app.
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Firebase Auth persistence fallback (memory):", err?.message);
  });

  // Todas as chamadas same-origin para /api carregam a identidade Firebase.
  // O servidor continua sendo a fonte de autorização; este interceptor apenas
  // padroniza o transporte do token para serviços/componentes legados.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith('/api/')) return nativeFetch(input, init);
    const token = await auth?.currentUser?.getIdToken();
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return nativeFetch(input, { ...init, headers });
  };

  functions = getFunctions(app);
  if (useEmulators) connectFunctionsEmulator(functions, import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1', Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || 5001));

  console.log("Firebase initialized: Auth + Firestore (Long Polling + Offline) + Functions.");
} catch (e: any) {
  console.error("Firebase App initialization error:", e);
  console.warn("Falling back to LocalStorage (Offline Mode Only)");
  db = null;
  auth = null;
  functions = null;
}

export { app, db, auth, functions };
