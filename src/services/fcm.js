import { deleteToken, onMessage } from "firebase/messaging";

import { ensureFcmSwReady } from "@/pwa/fcmBridge";
import { purgeOtherServiceWorkers } from "@/pwa/purgeSW";
import { registerSW } from "@/pwa/registerSW";

import AppError from "../utils/AppError.js";
import { firebaseConfig, getMessagingOrNull } from "../utils/firebaseInit";
import logError from "../utils/logError.js";

import { getFcmTokenSafe as requestFcmToken } from "./pushTokens";

const FCM_ENABLED = import.meta.env.VITE_ENABLE_FCM === "true";
const LS_KEY = "lrp_fcm_token_v1";

const firebaseMessagingConfig = {
  ...firebaseConfig,
  ...(import.meta.env.VITE_FIREBASE_VAPID_KEY
    ? { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY }
    : {}),
};

export function isSupportedBrowser() {
  return (
    FCM_ENABLED &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

let swRegPromise;
export async function ensureServiceWorkerRegistered() {
  if (!isSupportedBrowser()) return null;
  try {
    if (swRegPromise) return swRegPromise;
    swRegPromise = (async () => {
      try {
        if (navigator.serviceWorker?.getRegistration) {
          const scope = import.meta?.env?.BASE_URL || "/";
          const existing = await navigator.serviceWorker.getRegistration(scope);
          const scriptUrl =
            existing?.active?.scriptURL ||
            existing?.waiting?.scriptURL ||
            existing?.installing?.scriptURL ||
            "";
          if (scriptUrl.endsWith("/sw.js")) {
            const ackExisting = await ensureFcmSwReady(firebaseMessagingConfig);
            if (!ackExisting) {
              console.warn("[fcm] ensureFcmSwReady did not ACK (existing)");
            }
            return existing;
          }
        }
      } catch (lookupError) {
        logError(lookupError, { where: "fcm", action: "lookup-sw" });
      }

      await purgeOtherServiceWorkers();
      const registration = await registerSW();
      if (!registration) return null;
      const ack = await ensureFcmSwReady(firebaseMessagingConfig);
      if (!ack) {
        console.warn("[fcm] ensureFcmSwReady did not ACK");
      }
      return registration;
    })().catch((error) => {
      logError(error, { where: "fcm", action: "ensure-sw" });
      return null;
    });
    return swRegPromise;
  } catch (error) {
    logError(error, { where: "fcm", action: "ensure-sw" });
    return null;
  }
}

export async function requestFcmPermission() {
  if (!isSupportedBrowser()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch (error) {
    logError(error, { where: "fcm", action: "request-permission" });
    return "denied";
  }
}

export async function getFcmTokenSafe({ serviceWorkerRegistration } = {}) {
  if (!isSupportedBrowser()) return null;
  try {
    const messaging = await getMessagingOrNull();
    if (!messaging) {
      console.info("[fcm] messaging unsupported or unavailable");
      return null;
    }

    const registration =
      serviceWorkerRegistration || (await ensureServiceWorkerRegistered());
    if (!registration) {
      console.warn("[fcm] service worker registration unavailable");
      return null;
    }

    const token = await requestFcmToken({
      messaging,
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      try {
        localStorage.setItem(LS_KEY, token);
      } catch (error) {
        logError(error, { where: "fcm", action: "cache-token" });
      }
      console.info("[fcm] token ready");
      return token;
    }

    console.info("[fcm] token not issued (permission or support)");
    return null;
  } catch (error) {
    if (error instanceof AppError && error.code === "missing_vapid_key") {
      throw error;
    }
    logError(error, { where: "fcm", action: "get-token" });
    return null;
  }
}

export function onForegroundMessageSafe(cb) {
  if (!isSupportedBrowser()) return () => {};
  let unsub = () => {};
  getMessagingOrNull()
    .then((messaging) => {
      if (!messaging) return;
      unsub = onMessage(messaging, (payload) => {
        try {
          cb(payload);
        } catch (error) {
          logError(error, { where: "fcm", action: "on-foreground" });
        }
      });
    })
    .catch((error) =>
      logError(error, { where: "fcm", action: "on-foreground" }),
    );
  return () => unsub();
}

export async function revokeFcmToken() {
  try {
    const messaging = await getMessagingOrNull();
    if (messaging) {
      await deleteToken(messaging);
    }
  } catch (error) {
    logError(error, { where: "fcm", action: "revoke-token" });
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch (error) {
    logError(error, { where: "fcm", action: "clear-cache" });
  }
}
