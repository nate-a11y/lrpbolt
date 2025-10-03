/* LRP Portal enhancement: FCM token flow, 2025-10-03. */
import { AppError, logError } from "@/services/errors";

export async function getFcmTokenSafe({
  messaging,
  vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY,
} = {}) {
  if (!messaging) {
    throw new AppError("messaging instance required", { code: "bad_args" });
  }
  if (!vapidKey) {
    throw new AppError("missing VAPID key", { code: "missing_vapid_key" });
  }

  try {
    const { getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return null;
    const token = await getToken(messaging, { vapidKey });
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
      const { getMessaging, onMessage, isSupported } = await import(
        "firebase/messaging"
      );
      if (!(await isSupported())) return;
      const messaging = getMessaging(firebaseApp);
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
