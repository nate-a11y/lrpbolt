/* Proprietary and confidential. See LICENSE. */
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import { app, db, firebaseConfig } from "./firebaseInit";
import { logError as _logError } from "./logError";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;
const logError = (err, ctx) => {
  try { (_logError ? _logError(err, ctx) : console.error(ctx, err)); } catch { /* no-op */ }
};

export async function registerFcmServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const ready = await navigator.serviceWorker.ready;
    // pass config so SW can initialize firebase for background messages
    ready?.active?.postMessage({ __FIREBASE_CONFIG: firebaseConfig });
    return reg;
  } catch (err) {
    logError(err, { where: "registerFcmServiceWorker" });
    throw err;
  }
}

/** Ask permission, get token, write to Firestore */
export async function enableFcmForUser(user) {
  try {
    if (!user?.email) throw new Error("No user email; cannot enable FCM.");
    if (!(await isSupported())) throw new Error("FCM not supported in this browser.");

    const reg = await registerFcmServiceWorker();
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(`Notification permission: ${permission}`);

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg || undefined,
    });
    if (!token) throw new Error("Failed to get FCM token.");

    const key = `${user.email}__${token.substring(0, 16)}`;
    await setDoc(
      doc(db, "fcmTokens", key),
      {
        email: user.email,
        token,
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return token;
  } catch (err) {
    logError(err, { where: "enableFcmForUser" });
    throw err;
  }
}

/** Foreground listener */
export function onForegroundMessage(cb) {
  const messaging = getMessaging(app);
  return onMessage(messaging, (payload) => cb?.(payload));
}
