
import { initializeApp } from 'firebase/app';
import { initializeFirestore, Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration
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
  try {
      // Use initializeFirestore instead of getFirestore to enable long-polling
      // this fixes "Could not reach Cloud Firestore backend" in environments where 
      // standard gRPC/WebChannel connections are blocked.
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
      console.log("Firebase initialized successfully with Long Polling enabled.");
  } catch (firestoreError: any) {
      console.warn("Firestore initialization failed (Offline Mode enabled):", firestoreError.message);
      db = null;
  }
} catch (e: any) {
  console.error("Firebase App initialization error:", e);
  console.warn("Falling back to LocalStorage (Offline Mode)");
  db = null;
}

export { db };
