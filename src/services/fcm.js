import { deleteToken, onMessage } from "firebase/messaging";

import { ensureFcmSwReady } from "@/pwa/fcmBridge";
import { purgeOtherServiceWorkers } from "@/pwa/purgeSW";
import { registerSW } from "@/pwa/registerSW";

import {
  app as firebaseApp,
  firebaseConfig,
  getMessagingOrNull,
} from "../utils/firebaseInit";
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

export async function getFcmTokenSafe() {
  if (!isSupportedBrowser()) return null;
  try {
    await ensureServiceWorkerRegistered();
    const result = await requestFcmToken(
      firebaseApp,
      import.meta.env.VITE_FIREBASE_VAPID_KEY,
    );
    if (result?.ok && result.token) {
      try {
        localStorage.setItem(LS_KEY, result.token);
      } catch (error) {
        logError(error, { where: "fcm", action: "cache-token" });
      }
      return result.token;
    }
    if (result?.reason) {
      console.info("[fcm] token blocked", result.reason);
    }
    return null;
  } catch (error) {
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
