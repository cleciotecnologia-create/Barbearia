import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

export { app, db, auth };

// Health check to ensure connectivity
async function verifyConnectivity() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection'));
    console.log("Firebase Connected");
  } catch (e) {
    // Expected to fail if doc doesn't exist, but verifies network path
  }
}
verifyConnectivity();
