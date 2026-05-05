
import { initializeApp } from 'firebase/app';
import { initializeFirestore, Firestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';

// Configuração do Firebase do seu Web App
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
let db: Firestore | null = null;

try {
  app = initializeApp(firebaseConfig);
  
  // Inicializa o Firestore com Long Polling forçado para evitar bloqueios de gRPC/WebSocket
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    // Garante que propriedades undefined não quebrem a gravação no banco
    ignoreUndefinedProperties: true,
  });

  // Habilita persistência offline para que o app funcione mesmo sem conexão
  // Isso resolve o erro "Failed to get document because the client is offline"
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Múltiplas abas abertas, persistência habilitada apenas na primeira.
      console.warn("Firestore Persistence: Múltiplas abas detectadas. Cache ativo apenas na aba principal.");
    } else if (err.code === 'unimplemented') {
      // Browser não suporta IndexedDB
      console.warn("Firestore Persistence: Este navegador não suporta armazenamento offline.");
    }
  });

  console.log("Firebase initialized: Long Polling & Offline Persistence enabled.");
} catch (e: any) {
  console.error("Firebase App initialization error:", e);
  console.warn("Falling back to LocalStorage (Offline Mode Only)");
  db = null;
}

export { db };
