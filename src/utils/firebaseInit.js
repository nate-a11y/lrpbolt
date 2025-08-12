/* Proprietary and confidential. See LICENSE. */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * IMPORTANT:
 * Keep these values EXACTLY as currently set in the repo. If they come from env,
 * keep env. If they are hardcoded, KEEP THE HARDCODED LITERALS.
 * (Do not rename keys.)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "HARDCODE_KEEP_AS_IS",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "HARDCODE_KEEP_AS_IS",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "HARDCODE_KEEP_AS_IS",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "HARDCODE_KEEP_AS_IS",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "HARDCODE_KEEP_AS_IS",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "HARDCODE_KEEP_AS_IS",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // ok if undefined
};

// App singleton
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore singleton (HMR‑safe). Never call initializeFirestore twice.
const DB_KEY = "__LRP_DB_SINGLETON__";
if (!globalThis[DB_KEY]) {
  try {
    globalThis[DB_KEY] = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // If already initialized with options in this tab (HMR), reuse it:
    globalThis[DB_KEY] = getFirestore(app);
  }
}
export const db = globalThis[DB_KEY];

// Auth (safe to get repeatedly)
export const auth = getAuth(app);

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  // Uncomment for one-time cleanup during refactor:
  // navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
}
