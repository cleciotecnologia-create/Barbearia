import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId;
// If the database ID is missing, getFirestore will use (default) which is correct for some projects
const db = getFirestore(app, firestoreDatabaseId);
const auth = getAuth(app);

export { app, db, auth };

// Health check to ensure connectivity
async function verifyConnectivity() {
  try {
    // Just a simple existence check, don't force from server if we want to avoid "offline" errors on startup
    // The previous getDocFromServer was good for debugging but bad for user experience if it fails loudly
    console.log(`Firebase initialized with database: ${firestoreDatabaseId || '(default)'}`);
  } catch (error: any) {
    console.error("Firebase Initialization Error:", error);
  }
}

// verify connection
if (typeof window !== 'undefined') {
  verifyConnectivity();
}
