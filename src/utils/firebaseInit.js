/* Proprietary and confidential. See LICENSE. */
// Centralized Firebase init (modular). Always import THIS file first in main.jsx.

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported as messagingSupported } from "firebase/messaging";

import { bindFirestore } from "../services/normalizers";

// TODO: move to env at build-time; left hardcoded per request for now.
const firebaseConfig = {
  apiKey: "AIzaSyDziITaFCf1_8tb2iSExBC7FDGDOmWaGns",
  authDomain: "lrp---claim-portal.firebaseapp.com",
  projectId: "lrp---claim-portal",
  storageBucket: "lrp---claim-portal.firebasestorage.app",
  messagingSenderId: "799613895072",
  appId: "1:799613895072:web:1b41c28c6819198ce824c5",
  measurementId: "G-9NM69MZN6B",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
bindFirestore(db);
export const storage = getStorage(app);

export async function getMessagingIfSupported() {
  try {
    if (await messagingSupported()) return getMessaging(app);
  } catch {
    /* no-op */
  }
  return null;
}
