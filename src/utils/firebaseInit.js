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
  firebase.initializeApp({
    apiKey: "AIzaSyDziITaFCf1_8tb2iSExBC7FDGDOmWaGns",
    authDomain: "lrp---claim-portal.firebaseapp.com",
    projectId: "lrp---claim-portal",
    storageBucket: "lrp---claim-portal.firebasestorage.app",
    messagingSenderId: "799613895072",
    appId: "1:799613895072:web:1b41c28c6819198ce824c5",
    measurementId: "G-9NM69MZN6B",
  });

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
