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
 * Keep values exactly as they exist in the repo (env or hardcoded).
 * Do not rename keys. If an env var is missing at build time, the fallback
 * literal "HARDCODE_KEEP_AS_IS" preserves your current repo behavior.
 */
const firebaseConfig = {
    apiKey: "AIzaSyDziITaFCf1_8tb2iSExBC7FDGDOmWaGns",
    authDomain: "lrp---claim-portal.firebaseapp.com",
    projectId: "lrp---claim-portal",
    storageBucket: "lrp---claim-portal.firebasestorage.app",
    messagingSenderId: "799613895072",
    appId: "1:799613895072:web:1b41c28c6819198ce824c5",
    measurementId: "G-9NM69MZN6B", 
};

// App singleton
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore singleton (HMR‑safe)
const DB_INSTANCE_KEY = "__LRP_DB_SINGLETON__";
if (!globalThis[DB_INSTANCE_KEY]) {
  try {
    globalThis[DB_INSTANCE_KEY] = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Already initialized with options; reuse it
    globalThis[DB_INSTANCE_KEY] = getFirestore(app);
  }
}
export const db = globalThis[DB_INSTANCE_KEY];

// Auth (safe to call repeatedly)
export const auth = getAuth(app);
