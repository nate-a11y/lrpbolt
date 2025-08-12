// src/firebaseInit.js
import { auth, db } from "./firebase";
import { setPersistence, browserLocalPersistence, onAuthStateChanged, connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";

// Set persistence
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Ignore undefined properties
initializeFirestore(auth.app, { ignoreUndefinedProperties: true });

// Local dev emulator connection
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
}

// Debug auth
onAuthStateChanged(auth, (u) => {
  console.log("[AUTH]", Boolean(u), u?.email || null);
});
