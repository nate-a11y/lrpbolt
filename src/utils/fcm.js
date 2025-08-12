/* Proprietary and confidential. See LICENSE. */
import { getMessaging, getToken, isSupported, deleteToken } from "firebase/messaging";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

import { app, db } from "src/utils/firebaseInit";
import { logError as _logError } from "./logError";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;
const logError = (e, ctx) => {
  try {
    if (_logError) _logError(e, ctx);
    else console.error(ctx, e);
  } catch (err) { void err; /* ignore logging failures */ }
};

export async function notificationsSupported() {
  try {
    return (await isSupported()) && "Notification" in window;
  } catch (e) {
    void e;
    return false;
  }
}

export function getPermission() {
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

/** Request permission + register token; save under fcmTokens keyed by email+tokenPrefix */
export async function enableFcmForUser(user, extra = {}) {
  if (!user?.email) throw new Error("No user email.");
  if (!(await notificationsSupported())) throw new Error("Notifications not supported on this browser.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(`Permission: ${perm}`);

  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error("Failed to get FCM token.");

  const key = `${user.email}__${token.slice(0, 16)}`;
  await setDoc(
    doc(db, "fcmTokens", key),
    {
      email: user.email,
      token,
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
      ...extra,
    },
    { merge: true }
  );
  return token;
}

/** Revoke on this device: delete token + remove doc(s) for this token */
export async function disableFcmForUser(user) {
  if (!user?.email) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }).catch(() => null);
    if (currentToken) {
      await deleteToken(messaging);
      const key = `${user.email}__${currentToken.slice(0, 16)}`;
      await deleteDoc(doc(db, "fcmTokens", key)).catch(() => undefined);
    }
  } catch (e) {
    logError(e, { where: "disableFcmForUser" });
    throw e;
  }
}

/** Best practice: call occasionally (e.g., on login) to ensure token exists */
export async function ensureFcmToken(user, extra = {}) {
  if (!user?.email) return null;
  if (!(await notificationsSupported())) return null;
  if (getPermission() !== "granted") return null;
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }).catch(() => null);
  if (token) {
    const key = `${user.email}__${token.slice(0, 16)}`;
    await setDoc(
      doc(db, "fcmTokens", key),
      { email: user.email, token, userAgent: navigator.userAgent, updatedAt: serverTimestamp(), ...extra },
      { merge: true }
    );
  }
  return token;
}
