/* Proprietary and confidential. See LICENSE. */
// Centralized Firebase init (modular). Always import THIS file first in main.jsx.

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getMessaging,
  isSupported as messagingSupported,
} from "firebase/messaging";

import { bindFirestore } from "../services/normalizers";

import logError from "./logError.js";
import { env } from "./env.js";

const projectId = env.FIREBASE.PROJECT_ID;
const authDomain =
  env.FIREBASE.AUTH_DOMAIN ||
  (projectId ? `${projectId}.firebaseapp.com` : undefined);
const storageBucket =
  env.FIREBASE.STORAGE_BUCKET ||
  (projectId ? `${projectId}.appspot.com` : undefined);

export const firebaseConfig = {
  apiKey: env.FIREBASE.API_KEY,
  projectId,
  messagingSenderId: env.FIREBASE.MESSAGING_SENDER_ID,
  appId: env.FIREBASE.APP_ID,
  ...(authDomain ? { authDomain } : {}),
  ...(storageBucket ? { storageBucket } : {}),
  // ✅ Needed for Firebase Analytics + GA4
  ...(env.FIREBASE.MEASUREMENT_ID
    ? { measurementId: env.FIREBASE.MEASUREMENT_ID }
    : {}),
};

let appInstance;
export function getFirebaseApp() {
  if (appInstance) return appInstance;
  const existing = getApps()[0];
  appInstance = existing || initializeApp(firebaseConfig);
  return appInstance;
}

export const app = getFirebaseApp();
export const auth = getAuth(app);
let dbInstance;
function ensureFirestore(appInstance) {
  if (dbInstance) return dbInstance;
  try {
    dbInstance = initializeFirestore(appInstance, {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (error) {
    logError(error, {
      where: "firebaseInit",
      action: "initializeFirestore",
    });
    throw error;
  }
  return dbInstance;
}

export const db = ensureFirestore(app);
bindFirestore(db);
export const storage = getStorage(app);

let messagingInstance;
export async function getMessagingOrNull() {
  try {
    if (messagingInstance) return messagingInstance;
    if (!(await messagingSupported())) return null;

    messagingInstance = getMessaging(getFirebaseApp());
    return messagingInstance;
  } catch (err) {
    logError(err, { where: "firebaseInit", action: "getMessagingOrNull" });
    return null;
  }
}

/**
 * Returns the active ServiceWorkerRegistration controlling this page.
 * Falls back to navigator.serviceWorker.ready.
 */
export async function getControllingServiceWorkerRegistration() {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }

    if (navigator.serviceWorker.controller) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const byScope = registrations.find(
        (registration) =>
          registration?.scope &&
          window.location.href.startsWith(registration.scope),
      );
      if (byScope) return byScope;
    }

    const readyRegistration = await navigator.serviceWorker.ready;
    return readyRegistration || null;
  } catch (error) {
    logError(error, { where: "firebaseInit", action: "getControllingSW" });
    return null;
  }
}
