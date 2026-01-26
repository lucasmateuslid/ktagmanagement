
import { initializeApp } from 'firebase/app';
import { initializeFirestore, Firestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';

// Configuração do Firebase do seu Web App
const firebaseConfig = {
  apiKey: "AIzaSyC3KcC5ySMCU58Af1Lqv5jtcpZPdC__WlQ",
  authDomain: "ktag-d15b6.firebaseapp.com",
  projectId: "ktag-d15b6",
  storageBucket: "ktag-d15b6.firebasestorage.app",
  messagingSenderId: "843254608500",
  appId: "1:843254608500:web:8daab97451b1cecace5721"
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
