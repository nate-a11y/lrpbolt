/* Proprietary and confidential. See LICENSE. */
import { getToken } from "firebase/messaging";

import { getMessagingIfSupported } from "./firebaseInit";

// OPTIONAL: move to env later; keep here per request
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || "YOUR_PUBLIC_VAPID_KEY_HERE";

export async function registerFCM() {
  try {
    const messaging = await getMessagingIfSupported();
    if (!messaging) return { ok: false, reason: "messaging-not-supported" };

    // Service worker must be at the ROOT scope
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
      updateViaCache: "none",
      type: "classic",
    });

    // Wait until active to avoid race conditions
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });

    return token
      ? { ok: true, token }
      : { ok: false, reason: "getToken-null" };
  } catch (err) {
    console.warn("[FCM] register error:", err);
    return { ok: false, reason: err?.message || "unknown" };
  }
}
