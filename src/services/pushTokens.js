/* Proprietary and confidential. See LICENSE. */
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";

import AppError from "@/utils/AppError.js";
import logError from "@/utils/logError.js";

function normalizeVapidKey(input) {
  return typeof input === "string" ? input.trim() : "";
}

async function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return "denied";
  const current = Notification.permission;
  if (current === "granted" || current === "denied") {
    return current;
  }
  try {
    return await Notification.requestPermission();
  } catch (error) {
    logError(error, { where: "pushTokens", action: "request-permission" });
    return "denied";
  }
}

export async function getFcmTokenSafe({
  messaging,
  vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY,
  serviceWorkerRegistration,
} = {}) {
  const resolvedVapidKey = normalizeVapidKey(vapidKey);
  if (!resolvedVapidKey) {
    throw new AppError("missing_vapid_key", "missing_vapid_key");
  }

  try {
    const supported = await isSupported();
    if (!supported) return null;
    if (typeof window === "undefined") return null;
    if (!messaging) return null;
    if (!("Notification" in window)) return null;
    if (!("serviceWorker" in navigator)) return null;
    if (!("PushManager" in window)) return null;

    const permission = await ensureNotificationPermission();
    if (permission !== "granted") {
      return null;
    }

    let registration = serviceWorkerRegistration || null;
    if (!registration) {
      try {
        registration = await navigator.serviceWorker.ready;
      } catch (error) {
        logError(error, { where: "pushTokens", action: "sw-ready" });
      }
    }

    const options = registration
      ? {
          vapidKey: resolvedVapidKey,
          serviceWorkerRegistration: registration,
        }
      : { vapidKey: resolvedVapidKey };

    const token = await getToken(messaging, options);
    return token || null;
  } catch (error) {
    logError(error, { where: "pushTokens", action: "get-token" });
    return null;
  }
}

export function attachForegroundMessagingHandler(firebaseApp, onPayload) {
  try {
    const messaging = getMessaging(firebaseApp);
    return onMessage(messaging, (payload) => {
      try {
        console.info("[LRP][FCM][foreground]", payload);
        if (
          typeof window !== "undefined" &&
          typeof window.dispatchEvent === "function"
        ) {
          const EventCtor =
            typeof window.CustomEvent === "function"
              ? window.CustomEvent
              : CustomEvent;
          window.dispatchEvent(
            new EventCtor("LRP_FCM_MESSAGE", { detail: payload }),
          );
        }
        if (typeof onPayload === "function") {
          onPayload(payload);
        }
      } catch (innerError) {
        logError(innerError, {
          where: "pushTokens",
          action: "foreground-handler",
        });
      }
    });
  } catch (error) {
    logError(error, { where: "pushTokens", action: "attach-foreground" });
    return () => {};
  }
}
