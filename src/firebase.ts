import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId;
const db = getFirestore(app, firestoreDatabaseId);
const auth = getAuth(app);

// Enable Offline Persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

export { app, db, auth };

// Health check to ensure connectivity
async function verifyConnectivity() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log(`Firebase connected successfully to database: ${firestoreDatabaseId || '(default)'}`);
  } catch (error: any) {
    if (error.message && error.message.includes('the client is offline')) {
      console.error("Firestore Error: The client is offline. Please check your internet connection and Firebase configuration.");
    } else {
      // Ignored if it's just 'not-found' or 'permission-denied' for the test doc
      console.log("Firebase connection test performed.");
    }
  }
}

// verify connection
if (typeof window !== 'undefined') {
  verifyConnectivity();
}
