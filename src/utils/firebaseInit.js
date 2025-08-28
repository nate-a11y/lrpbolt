/* Proprietary and confidential. See LICENSE. */
// Centralized Firebase init (modular). Always import THIS file first in main.jsx.

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported as messagingSupported } from "firebase/messaging";

import { bindFirestore } from "../services/normalizers";

import logError from "./logError";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
bindFirestore(db);
export const storage = getStorage(app);

let messagingInstance;
export async function getMessagingOrNull() {
  try {
    if (messagingInstance) return messagingInstance;
    if (await messagingSupported()) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    logError(err, { where: "firebaseInit", action: "getMessagingOrNull" });
  }
  return null;
}
