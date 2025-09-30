/* Proprietary and confidential. See LICENSE. */
import { initializeApp, getApps } from "firebase/app";
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported,
} from "firebase/messaging";

import { registerSW } from "@/pwa/registerSW";
import { ensureFcmSwReady } from "@/pwa/fcmBridge";
import { purgeOtherServiceWorkers } from "@/pwa/purgeSW";
import logError from "@/utils/logError.js";

const LS_KEY = "lrp_fcm_token_v1";
const LEGACY_KEYS = [LS_KEY, "lrp_fcm_token"];

function getOrInitApp(config) {
  const existing = getApps();
  if (existing.length) return existing[0];
  return initializeApp(config);
}

function readCachedToken() {
  try {
    for (const key of LEGACY_KEYS) {
      const value = localStorage.getItem(key);
      if (value) {
        if (key !== LS_KEY) {
          writeCachedToken(value);
        }
        return value;
      }
    }
    return null;
  } catch (error) {
    logError(error, { where: "pushTokens", action: "readCache" });
    return null;
  }
}

function writeCachedToken(token) {
  try {
    if (token) {
      localStorage.setItem(LS_KEY, token);
    }
  } catch (error) {
    logError(error, { where: "pushTokens", action: "writeCache" });
  }
}

function clearCachedToken() {
  try {
    LEGACY_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    logError(error, { where: "pushTokens", action: "clearCache" });
  }
}

export async function getFcmTokenSafe(
  firebaseConfig,
  { vapidKey, forceRefresh = false } = {},
) {
  try {
    if (!(await isSupported())) return null;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }

    await purgeOtherServiceWorkers();
    await registerSW();

    const ready = await ensureFcmSwReady(firebaseConfig);
    if (!ready) {
      console.warn("[pushTokens] ensureFcmSwReady did not ACK");
    }

    const app = getOrInitApp(firebaseConfig);
    const messaging = getMessaging(app);

    let cached = readCachedToken();
    if (forceRefresh && cached) {
      try {
        await deleteToken(messaging);
      } catch (error) {
        logError(error, { where: "pushTokens", action: "deleteCachedToken" });
      }
      cached = null;
    }

    let registration;
    try {
      registration = await navigator.serviceWorker.ready;
    } catch (error) {
      logError(error, { where: "pushTokens", action: "swReady" });
      return cached;
    }
    if (!registration) return cached;
    const resolvedVapid =
      vapidKey ||
      firebaseConfig?.vapidKey ||
      import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!resolvedVapid) {
      logError(new Error("Missing VAPID key"), {
        where: "pushTokens",
        action: "resolveVapid",
      });
      return cached;
    }

    const token = await getToken(messaging, {
      vapidKey: resolvedVapid,
      serviceWorkerRegistration: registration,
    });

    if (token && token !== cached) {
      writeCachedToken(token);
      return token;
    }

    if (!token && cached) {
      return cached;
    }

    return token || null;
  } catch (error) {
    logError(error, { where: "pushTokens", action: "getToken" });
    return null;
  }
}

export async function clearFcmToken(firebaseConfig) {
  try {
    if (!(await isSupported())) {
      clearCachedToken();
      return;
    }
    const app = getOrInitApp(firebaseConfig);
    const messaging = getMessaging(app);
    await deleteToken(messaging);
  } catch (error) {
    logError(error, { where: "pushTokens", action: "clearToken" });
  } finally {
    clearCachedToken();
  }
}
