/* Proprietary and confidential. See LICENSE. */
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { getFirebaseApp } from "@/utils/firebaseInit";
import logError from "@/utils/logError.js";

const requiredFirebaseKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_VAPID_KEY",
];

const missingFirebaseKeys = requiredFirebaseKeys.filter(
  (key) => !import.meta.env[key],
);

if (missingFirebaseKeys.length) {
  const message = `Missing Firebase env vars: ${missingFirebaseKeys.join(", ")}`;
  if (import.meta.env.DEV) {
    console.warn(`[LRP] ${message}`);
  } else {
    throw new Error(message);
  }
}

export const app = getFirebaseApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

let messagingInstance = null;
try {
  messagingInstance = getMessaging(app);
} catch (error) {
  logError(error, { where: "services/firebase", action: "getMessaging" });
  messagingInstance = null;
}

export const messaging = messagingInstance;

if (import.meta.env.DEV) {
  console.log(
    "\uD83D\uDD25 Firebase project:",
    app?.options?.projectId || "unknown",
  );
}

export function getMessagingOrNull() {
  return messagingInstance;
}
