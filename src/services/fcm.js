import { getToken, onMessage, deleteToken } from "firebase/messaging";

import { registerSW } from "@/pwa/registerSW";

import { firebaseConfig, getMessagingOrNull } from "../utils/firebaseInit";
import logError from "../utils/logError.js";

const TOKEN_KEY = "lrp_fcm_token";
const FCM_ENABLED = import.meta.env.VITE_ENABLE_FCM === "true";

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
function sendFirebaseConfigMessage(registration) {
  if (!registration) return;
  try {
    registration.active?.postMessage({
      type: "FIREBASE_CONFIG",
      config: firebaseConfig,
    });
  } catch (err) {
    logError(err, { where: "fcm", action: "send-config" });
  }
}

function broadcastConfigToController() {
  try {
    navigator.serviceWorker.controller?.postMessage({
      type: "FIREBASE_CONFIG",
      config: firebaseConfig,
    });
  } catch (err) {
    logError(err, { where: "fcm", action: "controller-config" });
  }
}

export async function ensureServiceWorkerRegistered() {
  if (!isSupportedBrowser()) return null;
  try {
    if (swRegPromise) return swRegPromise;
    swRegPromise = registerSW()
      .then((reg) => {
        if (!reg) return null;
        sendFirebaseConfigMessage(reg);
        broadcastConfigToController();
        navigator.serviceWorker.ready
          .then((readyReg) => {
            sendFirebaseConfigMessage(readyReg);
            broadcastConfigToController();
          })
          .catch((err) => logError(err, { where: "fcm", action: "sw-ready" }));
        return reg;
      })
      .catch((err) => {
        logError(err, { where: "fcm", action: "register-sw" });
        return null;
      });
    return swRegPromise;
  } catch (err) {
    logError(err, { where: "fcm", action: "ensure-sw" });
    return null;
  }
}

export async function requestFcmPermission() {
  if (!isSupportedBrowser()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch (err) {
    logError(err, { where: "fcm", action: "request-permission" });
    return "denied";
  }
}

export async function getFcmTokenSafe() {
  if (!isSupportedBrowser()) return null;
  const cached = localStorage.getItem(TOKEN_KEY);
  if (cached) return cached;
  try {
    const messaging = await getMessagingOrNull();
    if (!messaging) return null;
    const reg = await ensureServiceWorkerRegistered();
    if (!reg) return null;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (token) localStorage.setItem(TOKEN_KEY, token);
    return token || null;
  } catch (err) {
    logError(err, { where: "fcm", action: "get-token" });
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
        } catch (err) {
          logError(err, { where: "fcm", action: "on-foreground" });
        }
      });
    })
    .catch((err) => logError(err, { where: "fcm", action: "on-foreground" }));
  return () => unsub();
}

export async function revokeFcmToken() {
  try {
    const messaging = await getMessagingOrNull();
    if (messaging) {
      await deleteToken(messaging);
    }
  } catch (err) {
    logError(err, { where: "fcm", action: "revoke-token" });
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}
