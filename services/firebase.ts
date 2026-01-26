import { initializeApp } from 'firebase/app';
import { initializeFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// As chaves públicas do Firebase devem vir de variáveis de ambiente (Vite)
// Crie um arquivo .env na raiz com: FIREBASE_API_KEY=..., etc.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC3KcC5ySMCU58Af1Lqv5jtcpZPdC__WlQ", // Fallback apenas para dev, ideal remover
  authDomain: "ktag-d15b6.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "ktag-d15b6",
  storageBucket: "ktag-d15b6.firebasestorage.app",
  messagingSenderId: "843254608500",
  appId: process.env.FIREBASE_APP_ID || "1:843254608500:web:8daab97451b1cecace5721"
};

const app = initializeApp(firebaseConfig);

// Inicializa Firestore
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
});

// Habilita persistência offline
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  console.warn("Persistence Error:", err.code);
});

// Inicializa Cloud Functions (Onde a mágica de segurança acontece)
const functions = getFunctions(app, 'us-central1');

// Se estiver rodando emulador local (opcional)
// connectFunctionsEmulator(functions, "localhost", 5001);

export { db, functions };