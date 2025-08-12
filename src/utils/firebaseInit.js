// src/utils/firebaseInit.js
import {
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  connectAuthEmulator,
} from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

import app, { auth, db, firebaseConfig } from "../firebase";
const functions = getFunctions(app);

// Sessions
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("[firebaseInit] setPersistence failed:", err?.message || err);
});

// Emulators (dev only)
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  try {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "localhost", 8080);
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.info("[firebaseInit] Connected to Firebase emulators.");
  } catch (err) {
    console.error("[firebaseInit] Emulator connect failed:", err?.message || err);
  }
}

// Optional debug in dev
if (import.meta.env.DEV) {
  onAuthStateChanged(auth, (u) => {
    console.log("[AUTH]", Boolean(u), u?.email || null);
  });
}
export { app, db, auth, functions, firebaseConfig };
