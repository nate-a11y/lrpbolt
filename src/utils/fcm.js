/* Proprietary and confidential. See LICENSE. */

export async function notificationsSupported() {
  return false;
}

export function getPermission() {
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

export async function enableFcmForUser() {
  throw new Error("FCM disabled");
}

export async function disableFcmForUser() {
  /* no-op */
}

export async function ensureFcmToken() {
  return null;
}
