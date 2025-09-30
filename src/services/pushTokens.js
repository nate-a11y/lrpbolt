/* Proprietary and confidential. See LICENSE. */
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";

import logError from "@/utils/logError.js";

function resolveVapidKey(explicitKey) {
  const direct = typeof explicitKey === "string" ? explicitKey.trim() : "";
  if (direct) return direct;
  const envKey =
    typeof import.meta?.env?.VITE_FIREBASE_VAPID_KEY === "string"
      ? import.meta.env.VITE_FIREBASE_VAPID_KEY.trim()
      : "";
  return envKey;
}

export async function getFcmTokenSafe(
  firebaseApp,
  vapidKeyFromEnv,
  swRegistration,
) {
  try {
    const supported = await isSupported();
    if (!supported) {
      return { ok: false, reason: "messaging_not_supported" };
    }
    if (typeof window === "undefined") {
      return { ok: false, reason: "no_window" };
    }
    if (!("Notification" in window)) {
      return { ok: false, reason: "notifications_api_missing" };
    }
    if (!("serviceWorker" in navigator)) {
      return { ok: false, reason: "service_worker_missing" };
    }
    if (!("PushManager" in window)) {
      return { ok: false, reason: "push_manager_missing" };
    }

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: `permission_${permission}` };
    }

    const messaging = getMessaging(firebaseApp);
    const vapidKey = resolveVapidKey(vapidKeyFromEnv);
    if (!vapidKey) {
      return { ok: false, reason: "missing_vapid_key" };
    }

    let registration = swRegistration || null;
    if (!registration) {
      try {
        registration = await navigator.serviceWorker.ready;
      } catch (error) {
        logError(error, {
          where: "pushTokens",
          action: "sw-ready",
        });
      }
    }

    const options = registration
      ? { vapidKey, serviceWorkerRegistration: registration }
      : { vapidKey };
    const token = await getToken(messaging, options);
    if (!token) {
      return { ok: false, reason: "no_token" };
    }

    return { ok: true, token };
  } catch (error) {
    logError(error, { where: "pushTokens", action: "get-token" });
    return { ok: false, reason: "exception" };
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
