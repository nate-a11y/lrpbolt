/* LRP Portal enhancement: FCM bootstrap, 2025-10-03. */
import { initializeApp } from "firebase/app";
import {
  deleteToken as deleteMessagingToken,
  getMessaging,
  isSupported as isMessagingSupported,
  onMessage,
} from "firebase/messaging";

import { AppError, logError } from "@/services/errors";
import {
  getFcmTokenSafe as requestFcmToken,
  requestNotificationPermission,
} from "@/services/pushTokens";

let _app;
let _messaging;

export function initFirebaseApp() {
  if (_app) return _app;
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
  _app = initializeApp(cfg);
  return _app;
}

function getMessagingInstance() {
  if (_messaging) return _messaging;
  _messaging = getMessaging(initFirebaseApp());
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
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    // Optionally register /sw.js too if your app uses it, but avoid duplicates
    return reg;
  } catch (err) {
    logError(err, { where: "ensureServiceWorkerRegistered" });
    return null;
  }
}

export async function initMessagingAndToken() {
  try {
    initFirebaseApp();
    await ensureServiceWorkerRegistered();

    // messaging only after SW is available (preferred but not strictly required)
    if (!(await isMessagingSupported())) return null;
    getMessagingInstance();
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return null;

    const token = await requestFcmToken({
      messaging: _messaging,
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });
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
    return token;
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
    initFirebaseApp();
    if (!(await isMessagingSupported())) return null;
    const messaging = getMessagingInstance();
    if (!options?.skipSw) {
      await ensureServiceWorkerRegistered();
    }
    const token = await requestFcmToken({
      messaging,
      vapidKey: options?.vapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });
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
