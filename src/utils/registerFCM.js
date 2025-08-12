/* Lightweight, defensive FCM permission + token flow */
import { getToken, isSupported } from "firebase/messaging";

import { messaging } from "./firebaseInit";

const VAPID_KEY = undefined; // Use FCM auto key unless you add a Web Push key.

export async function ensureFcmToken(onToken) {
  try {
    if (!messaging || !(await isSupported())) return null;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;

    const token = await getToken(messaging, VAPID_KEY ? { vapidKey: VAPID_KEY } : undefined);
    if (token && typeof onToken === "function") onToken(token);
    return token || null;
  } catch (err) {
    console.warn("[FCM] token error", err);
    return null;
  }
}
