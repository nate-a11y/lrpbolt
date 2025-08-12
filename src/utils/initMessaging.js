/* Proprietary and confidential. See LICENSE. */
import { getMessaging, isSupported, getToken, onMessage, deleteToken } from "firebase/messaging";

import { app } from "./firebaseInit";

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY;

async function registerRootSW() {
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  if (reg.active) return reg;
  await new Promise((resolve) => {
    const sw = reg.installing || reg.waiting;
    if (!sw) return resolve();
    sw.addEventListener("statechange", () => {
      if (sw.state === "activated") resolve();
    });
  });
  return reg;
}

export async function setupMessaging() {
  if (!("Notification" in window)) throw new Error("Notifications not supported");
  if (!(await isSupported())) throw new Error("FCM not supported in this browser/context");

  if (Notification.permission !== "granted") {
    const res = await Notification.requestPermission();
    if (res !== "granted") throw new Error("Notification permission denied");
  }

  const registration = await registerRootSW();

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Failed to obtain FCM token");
  console.log("✅ FCM token:", token);

  // Foreground messages -> surface an OS‑level notification via the SW
  onMessage(messaging, (payload) => {
    try {
      const title = payload?.notification?.title || "LRP";
      const options = {
        body: payload?.notification?.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        data: payload?.data || {},
      };
      registration.showNotification(title, options);
    } catch (err) {
      console.error("[LRP] onMessage notify error:", err);
    }
  });

  return token;
}

export async function refreshMessagingToken() {
  if (!(await isSupported())) return null;
  const messaging = getMessaging(app);
  try {
    await deleteToken(messaging);
  } catch (err) {
    console.warn("[LRP] deleteToken failed (will continue):", err?.message || err);
  }
  return setupMessaging();
}
