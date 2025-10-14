import { isSupported, getMessaging, getToken } from "firebase/messaging";

import { getFirebaseApp } from "@/utils/firebaseInit";
import { env } from "@/utils/env";
import logError from "@/utils/logError.js";

export async function getFcmTokenSafe() {
  try {
    if (!env.ENABLE_FCM) return null;

    const supported = await isSupported();
    if (!supported) return null;

    const vapidKey = env.FCM_VAPID_KEY;
    if (!vapidKey) {
      console.warn("[FCM] Missing VAPID key env (VITE_FCM_VAPID_KEY).");
      return null;
    }

    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, { vapidKey });
    return token || null;
  } catch (err) {
    // Quietly absorb adblock/offline cases
    console.warn("[FCM] getToken failed:", err?.message || err);
    return null;
  }
}

export async function requestNotificationPermission() {
  try {
    if (typeof self === "undefined" || !("Notification" in self)) {
      return "denied";
    }
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return await Notification.requestPermission();
  } catch (err) {
    logError(err, { where: "requestNotificationPermission" });
    return "denied";
  }
}

export function attachForegroundMessagingHandler(firebaseApp, onPayload) {
  let detach = () => {};
  (async () => {
    try {
      const { onMessage } = await import("firebase/messaging");
      if (!(await isSupported())) return;
      const messaging = getMessaging(firebaseApp || getFirebaseApp());
      detach = onMessage(messaging, (payload) => {
        try {
          if (typeof onPayload === "function") {
            onPayload(payload);
          }
        } catch (handlerError) {
          logError(handlerError, {
            where: "attachForegroundMessagingHandler",
            phase: "handler",
          });
        }
      });
    } catch (err) {
      logError(err, { where: "attachForegroundMessagingHandler" });
    }
  })();
  return () => {
    try {
      detach();
    } catch (err) {
      logError(err, {
        where: "attachForegroundMessagingHandler",
        phase: "detach",
      });
    }
  };
}
