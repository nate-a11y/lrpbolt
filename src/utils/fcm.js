/* Proprietary and confidential. See LICENSE. */

import {
  isSupportedBrowser,
  requestFcmPermission,
  getFcmTokenSafe,
  revokeFcmToken,
} from "../services/fcm";

import logError from "./logError.js";

export async function notificationsSupported() {
  return isSupportedBrowser();
}

export function getPermission() {
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

export async function enableFcmForUser() {
  const perm = await requestFcmPermission();
  if (perm !== "granted") throw new Error("permission denied");
  const token = await getFcmTokenSafe();
  if (!token) throw new Error("token unavailable");
  return token;
}

export async function disableFcmForUser() {
  try {
    await revokeFcmToken();
  } catch (err) {
    logError(err, { where: "fcm", action: "disable" });
  }
}

export async function ensureFcmToken() {
  try {
    return await getFcmTokenSafe();
  } catch (err) {
    logError(err, { where: "fcm", action: "ensure-token" });
    return null;
  }
}
