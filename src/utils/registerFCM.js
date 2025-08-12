/* Proprietary and confidential. See LICENSE. */
import { getToken } from "firebase/messaging";

import { getMessagingIfSupported } from "./firebaseInit";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || "YOUR_PUBLIC_VAPID_KEY_HERE";
const FCM_TOKEN_KEY = "lrp:fcm-token";
const FCM_ATTEMPTED_KEY = "lrp:fcm-attempted"; // avoid loops in a session

export async function registerFCM() {
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return { ok: false, reason: "unsupported" };
    }
    // Only once per session to avoid loops
    if (sessionStorage.getItem(FCM_ATTEMPTED_KEY) === "1") {
      return { ok: true, reason: "already-attempted" };
    }
    sessionStorage.setItem(FCM_ATTEMPTED_KEY, "1");

    if (Notification.permission === "denied") return { ok: false, reason: "denied" };

    const messaging = await getMessagingIfSupported();
    if (!messaging) return { ok: false, reason: "messaging-not-supported" };

    // Ensure a single root scope SW (avoid scope mismatch loops)
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
      updateViaCache: "none",
      type: "classic",
    });

    await navigator.serviceWorker.ready;

    // Only request permission when user interacts, else bail silently
    if (Notification.permission === "default") {
      // Do not prompt automatically; caller may prompt later.
      return { ok: false, reason: "permission-default" };
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (token && token !== localStorage.getItem(FCM_TOKEN_KEY)) {
      localStorage.setItem(FCM_TOKEN_KEY, token);
      // TODO: POST token to backend if needed
    }
    return { ok: true, token };
  } catch (err) {
    console.warn("[FCM] register error:", err);
    return { ok: false, reason: err?.message || "unknown" };
  }
}

