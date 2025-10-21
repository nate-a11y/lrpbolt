/* FIX: reuse unified app and guard repeated bootstrap */
import {
  deleteToken as deleteMessagingToken,
  getMessaging,
  isSupported as isMessagingSupported,
  onMessage,
} from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import { getFirebaseApp } from "@/utils/firebaseInit";
import { messaging as firebaseMessaging, db } from "@/services/firebase.js";
import { AppError, logError } from "@/services/errors";
import {
  getFcmTokenSafe as retrieveFcmToken,
  requestNotificationPermission,
} from "@/services/pushTokens";
import { env } from "@/utils/env";

let _messaging;
let hasConsoleMessageListener = false;

export function initFirebaseApp() {
  // legacy callers still import this; keep API but use our singleton
  return getFirebaseApp();
}

function getMessagingInstance() {
  if (_messaging) return _messaging;
  const app = getFirebaseApp();
  _messaging = getMessaging(app);
  attachConsoleLogging(_messaging);
  return _messaging;
}

function attachConsoleLogging(instance) {
  if (hasConsoleMessageListener) return;
  if (!instance) return;
  try {
    onMessage(instance, (payload) => {
      // eslint-disable-next-line no-console
      console.log("\uD83D\uDD25 FCM message:", payload);
    });
    hasConsoleMessageListener = true;
  } catch (err) {
    logError(err, { where: "fcm.attachConsoleLogging" });
  }
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
    const existing =
      (await navigator.serviceWorker
        .getRegistration("/sw.js")
        .catch(() => null)) ||
      (await navigator.serviceWorker.getRegistration().catch(() => null));
    if (existing?.active?.scriptURL?.includes("/sw.js")) {
      window.__LRP_SW_REG__ = existing;
      return existing;
    }
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
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
    const swReg = await ensureServiceWorkerRegistered();

    if (!(await isMessagingSupported())) return null;

    _messaging = _messaging || getMessagingInstance();
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return null;

    const token = await retrieveFcmToken(swReg);
    if (token) {
      // eslint-disable-next-line no-console
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

export async function registerFCM() {
  try {
    const token = await initMessagingAndToken();
    if (token && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("\uD83D\uDCF2 FCM token:", token);
    }
    return token;
  } catch (err) {
    logError(err, { where: "fcm.registerFCM" });
    return null;
  }
}

attachConsoleLogging(firebaseMessaging);

export async function requestFcmPermission() {
  return requestNotificationPermission();
}

export async function getFcmTokenSafe(options = {}) {
  try {
    if (!env.ENABLE_FCM) return null;
    getFirebaseApp();
    if (!(await isMessagingSupported())) return null;
    const swReg = options?.skipSw
      ? window.__LRP_SW_REG__ || null
      : await ensureServiceWorkerRegistered();
    getMessagingInstance();
    const token = await retrieveFcmToken(swReg);
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

export async function ensureFcmToken(user) {
  try {
    if (!user) return null;
    const token = await registerFCM();
    if (!token) return null;
    await setDoc(
      doc(db, "fcmTokens", token),
      {
        email: user.email || null,
        source: "optin-dialog",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return token;
  } catch (err) {
    logError(err, { where: "ensureFcmToken" });
    return null;
  }
}

export function listenForegroundMessages(cb) {
  try {
    return onForegroundMessageSafe((payload) => {
      if (typeof cb === "function") {
        try {
          cb(payload);
        } catch (handlerError) {
          logError(handlerError, {
            where: "listenForegroundMessages",
            phase: "handler",
          });
        }
        return;
      }
      const title = payload?.notification?.title;
      if (!title) return;
      const body = payload.notification.body || "";
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-alert
        window.alert(`${title}\n${body}`);
      }
    });
  } catch (err) {
    logError(err, { where: "listenForegroundMessages" });
    return () => {};
  }
}
