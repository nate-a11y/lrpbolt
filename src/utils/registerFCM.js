/* Proprietary and confidential. See LICENSE. */
import { getToken } from "firebase/messaging";

import { getMessagingIfSupported } from "./firebaseInit";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || "YOUR_PUBLIC_VAPID_KEY_HERE";
const FCM_TOKEN_KEY = "lrp:fcm-token";
const FCM_ATTEMPTED_KEY = "lrp:fcm-attempted";

export async function registerFCM() {
  try {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      return { ok: false, reason: "unsupported" };
    }
    if (sessionStorage.getItem(FCM_ATTEMPTED_KEY) === "1") {
      return { ok: true, reason: "already-attempted" };
    }
    sessionStorage.setItem(FCM_ATTEMPTED_KEY, "1");

    const messaging = await getMessagingIfSupported();
    if (!messaging) return { ok: false, reason: "messaging-not-supported" };

    // Register the dedicated FCM SW at root scope
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
      updateViaCache: "none",
      type: "classic",
    });
    await navigator.serviceWorker.ready;

    // Don't auto-prompt users. If permission default, bail silently.
    if (Notification.permission === "default") {
      return { ok: false, reason: "permission-default" };
    }
    if (Notification.permission === "denied") {
      return { ok: false, reason: "denied" };
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token && token !== localStorage.getItem(FCM_TOKEN_KEY)) {
      localStorage.setItem(FCM_TOKEN_KEY, token);
      // TODO: POST token to backend
    }
    return { ok: true, token };
  } catch (err) {
    console.warn("[FCM] register error:", err);
    return { ok: false, reason: err?.message || "unknown" };
  }
}
