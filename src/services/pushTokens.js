/* Proprietary and confidential. See LICENSE. */
import { initializeApp, getApps } from "firebase/app";
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported,
} from "firebase/messaging";

import { purgeOtherServiceWorkers } from "@/pwa/purgeSW";
import { registerSW } from "@/pwa/registerSW";
import { ensureFcmSwReady } from "@/pwa/fcmBridge";

const LS_KEY = "lrp_fcm_token_v1";
const BIND_KEY = "lrp_fcm_first_bind_done_v1";

export async function getFcmTokenSafe(
  firebaseConfig,
  { vapidKey, forceRefresh = false } = {},
) {
  try {
    if (!(await isSupported())) return null;
    await purgeOtherServiceWorkers();
    await registerSW();
    await ensureFcmSwReady(firebaseConfig);

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    let cached = null;
    try {
      cached = localStorage.getItem(LS_KEY) || null;
    } catch (error) {
      console.warn("[pushTokens] cache read failed", error);
    }
    let firstBindDone = false;
    try {
      firstBindDone = localStorage.getItem(BIND_KEY) === "1";
    } catch (error) {
      console.warn("[pushTokens] bind flag read failed", error);
    }
    if (forceRefresh || !firstBindDone) {
      if (cached) {
        try {
          await deleteToken(messaging);
        } catch (error) {
          console.error("[pushTokens] deleteToken failed", error);
        }
      }
      cached = null;
    }

    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: vapidKey || firebaseConfig.vapidKey,
      serviceWorkerRegistration: reg,
    });

    if (token && token !== cached) {
      try {
        localStorage.setItem(LS_KEY, token);
      } catch (error) {
        console.warn("[pushTokens] cache write failed", error);
      }
    }
    if (!firstBindDone) {
      try {
        localStorage.setItem(BIND_KEY, "1");
      } catch (error) {
        console.warn("[pushTokens] bind flag write failed", error);
      }
    }
    return token || cached || null;
  } catch (e) {
    console.error("[getFcmTokenSafe] failed", e);
    return null;
  }
}

export async function clearFcmToken(firebaseConfig) {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    await deleteToken(messaging);
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(BIND_KEY);
    } catch (error) {
      console.warn("[pushTokens] cache clear failed", error);
    }
  } catch (e) {
    console.error("[clearFcmToken] failed", e);
  }
}
