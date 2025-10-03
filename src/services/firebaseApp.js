/* LRP Portal enhancement: unified Firebase app singleton, 2025-10-03 */
import { initializeApp, getApps, getApp } from "firebase/app";

export function getFirebaseApp() {
  const apps = getApps();
  if (apps.length) return getApp(); // use existing [DEFAULT]
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
  return initializeApp(cfg); // [DEFAULT]
}
