/* FIX: reuse unified app and guard repeated bootstrap */
import {
  deleteToken as deleteMessagingToken,
  getMessaging,
  isSupported as isMessagingSupported,
  onMessage,
} from "firebase/messaging";

import { getFirebaseApp } from "@/utils/firebaseInit";
import { AppError, logError } from "@/services/errors";
import {
  getFcmTokenSafe as retrieveFcmToken,
  requestNotificationPermission,
} from "@/services/pushTokens";
import { env } from "@/utils/env";

let _messaging;

export function initFirebaseApp() {
  // legacy callers still import this; keep API but use our singleton
  return getFirebaseApp();
}

function getMessagingInstance() {
  if (_messaging) return _messaging;
  const app = getFirebaseApp();
  _messaging = getMessaging(app);
  return _messaging;
}

export function isSupportedBrowser() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function ensureServiceWorkerRegistered() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }
  if (!("serviceWorker" in navigator)) return null;
  if (window.__LRP_SW_REG__) return window.__LRP_SW_REG__;
  try {
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    window.__LRP_SW_REG__ = reg;
    return reg;
  } catch (err) {
    logError(err, { where: "ensureServiceWorkerRegistered" });
    return null;
  }
}

export async function initMessagingAndToken() {
  try {
    if (!env.ENABLE_FCM) return null;
    if (typeof window !== "undefined") {
      if (window.__LRP_FCM_BOOT__) return null; // guard double-run
      window.__LRP_FCM_BOOT__ = true;
    }

    getFirebaseApp(); // ensure app exists
    await ensureServiceWorkerRegistered();

    if (!(await isMessagingSupported())) return null;

    _messaging = _messaging || getMessagingInstance();
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return null;

    const token = await retrieveFcmToken();
    if (token) {
      console.info("[LRP] FCM token acquired");
      try {
        localStorage.setItem("lrp_fcm_token_v1", token);
      } catch (storageError) {
        logError(storageError, {
          where: "initMessagingAndToken",
          phase: "cache",
        });
      }
    } else {
      console.warn("[LRP] FCM token not acquired");
    }
    return token || null;
  } catch (err) {
    logError(new AppError("FCM init failed", { code: "fcm_init", cause: err }));
    return null;
  }
}

export async function requestFcmPermission() {
  return requestNotificationPermission();
}

export async function getFcmTokenSafe(options = {}) {
  try {
    if (!env.ENABLE_FCM) return null;
    getFirebaseApp();
    if (!(await isMessagingSupported())) return null;
    if (!options?.skipSw) {
      await ensureServiceWorkerRegistered();
    }
    getMessagingInstance();
    const token = await retrieveFcmToken();
    if (token) {
      try {
        localStorage.setItem("lrp_fcm_token_v1", token);
      } catch (storageError) {
        logError(storageError, { where: "getFcmTokenSafe", phase: "cache" });
      }
    }
    return token;
  } catch (err) {
    if (err instanceof AppError && err.code === "missing_vapid_key") {
      throw err;
    }
    logError(err, { where: "getFcmTokenSafe" });
    return null;
  }
}

export function onForegroundMessageSafe(cb) {
  if (typeof cb !== "function") return () => {};
  let unsubscribe = () => {};
  (async () => {
    try {
      if (!(await isMessagingSupported())) return;
      const messaging = getMessagingInstance();
      unsubscribe = onMessage(messaging, (payload) => {
        try {
          cb(payload);
        } catch (handlerError) {
          logError(handlerError, {
            where: "onForegroundMessageSafe",
            phase: "handler",
          });
        }
      });
    } catch (err) {
      logError(err, { where: "onForegroundMessageSafe" });
    }
  })();
  return () => {
    try {
      unsubscribe();
    } catch (err) {
      logError(err, { where: "onForegroundMessageSafe", phase: "unsubscribe" });
    }
  };
}

export async function revokeFcmToken() {
  try {
    if (!(await isMessagingSupported())) return;
    const messaging = getMessagingInstance();
    await deleteMessagingToken(messaging);
  } catch (err) {
    logError(err, { where: "revokeFcmToken" });
  }
  try {
    localStorage.removeItem("lrp_fcm_token_v1");
  } catch (storageError) {
    logError(storageError, { where: "revokeFcmToken", phase: "clear-cache" });
  }
}
