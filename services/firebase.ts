
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC3KcC5ySMCU58Af1Lqv5jtcpZPdC__WlQ",
  authDomain: "ktag-d15b6.firebaseapp.com",
  projectId: "ktag-d15b6",
  storageBucket: "ktag-d15b6.firebasestorage.app",
  messagingSenderId: "843254608500",
  appId: "1:843254608500:web:8daab97451b1cecace5721"
};

let db: any = null;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase initialized successfully");
} catch (e) {
  console.error("Firebase init error:", e);
  // Fallback to local storage is handled in storage.ts if db is null
}

export { db };
