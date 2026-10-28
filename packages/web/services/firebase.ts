import { initializeApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, Auth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const localProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-ktag-local';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (useEmulators ? 'local-emulator-key' : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (useEmulators ? `${localProjectId}.firebaseapp.com` : undefined),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (useEmulators ? localProjectId : undefined),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (useEmulators ? `${localProjectId}.firebasestorage.app` : undefined),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (useEmulators ? '1234567890' : undefined),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (useEmulators ? '1:1234567890:web:local-emulator' : undefined),
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let functions: Functions | null = null;

try {
  app = initializeApp(firebaseConfig);
} catch (e: any) {
  console.error("Firebase App initialization error:", e);
}

if (app) {
  try {
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    if (useEmulators) {
      connectFirestoreEmulator(
        db,
        import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1',
        Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080),
      );
    }
  } catch (error) {
    console.warn('Firestore offline persistence unavailable; using the default Firestore client.', error);
    try { db = getFirestore(app); } catch (fallbackError) { console.error('Firestore initialization failed:', fallbackError); }
  }

  try {
    auth = getAuth(app);
    if (useEmulators) {
      const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
      const authPort = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099);
      connectAuthEmulator(auth, `http://${emulatorHost}:${authPort}`, { disableWarnings: true });
    }
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('Firebase Auth persistence fallback (memory):', error?.message);
    });

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.startsWith('/api/')) return nativeFetch(input, init);
      const token = await auth?.currentUser?.getIdToken();
      const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return nativeFetch(input, { ...init, headers });
    };
  } catch (error) {
    console.error('Firebase Auth initialization error:', error);
  }

  try {
    functions = getFunctions(app);
    if (useEmulators) {
      connectFunctionsEmulator(
        functions,
        import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1',
        Number(import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || 5001),
      );
    }
  } catch (error) {
    console.error('Firebase Functions initialization error:', error);
  }

  console.log('Firebase initialized: Auth + Firestore + Functions.');
} else {
  console.warn('Firebase app unavailable; falling back to local storage.');
}

export { app, db, auth, functions };
