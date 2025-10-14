import { isSupported, getMessaging, getToken } from "firebase/messaging";

import { AppError, logError } from "@/services/errors";
import { getFirebaseApp } from "@/utils/firebaseInit";
import { env } from "@/utils/env";

export async function getFcmTokenSafe(swReg) {
  try {
    if (!env.ENABLE_FCM) return null;

    if (!(await isSupported())) return null;

    const vapidKey = env.FCM_VAPID_KEY;
    if (!vapidKey) {
      throw new AppError("VAPID key missing", {
        code: "missing_vapid_key",
        context: { where: "getFcmTokenSafe" },
      });
    }

    const registration = swReg || null;
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey,
      ...(registration ? { serviceWorkerRegistration: registration } : {}),
    });
    return token || null;
  } catch (err) {
    logError(err, { where: "getFcmTokenSafe" });
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
