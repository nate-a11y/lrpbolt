/* Proprietary and confidential. See LICENSE. */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, // optional
};

function assertConfig(config) {
  const missing = Object.entries(config)
    .filter(([k, v]) => !v && k !== "measurementId")
    .map(([k]) => k);
  if (missing.length) {
    console.error("[LRP] Missing Firebase env(s):", missing);
    throw new Error(`Firebase config missing: ${missing.join(", ")}`);
  }
}
assertConfig(cfg);

export const app = getApps().length ? getApp() : initializeApp(cfg);
export const db = getFirestore(app);

// TEMP: expose for runtime sanity checks (safe)
if (typeof window !== "undefined") {
  console.log("[LRP] Firebase app options:", app.options);
  window.__LRP_APP__ = app;
}
