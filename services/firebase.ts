import * as firebaseApp from 'firebase/app';
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
  // Access initializeApp from namespace object, casting to any to bypass strict type checking if definitions are mismatched
  const app = (firebaseApp as any).initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase initialized with provided credentials");
} catch (e) {
  console.error("Firebase init error", e);
}

export { db };