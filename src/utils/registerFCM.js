import { getToken, isSupported } from "firebase/messaging";

import { messaging } from "./firebaseInit";

const VAPID_KEY = undefined; // optional later

export async function ensureFcmToken(onToken) {
  try {
    if (!(await isSupported()) || !messaging || !("serviceWorker" in navigator)) return null;

    // Ensure our SW is registered at root scope
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;

    const token = await getToken(
      messaging,
      VAPID_KEY ? { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }
                : { serviceWorkerRegistration: reg }
    );
    if (token && typeof onToken === "function") onToken(token);
    return token || null;
  } catch (err) {
    console.warn("[FCM] token error", err);
    return null;
  }
}
