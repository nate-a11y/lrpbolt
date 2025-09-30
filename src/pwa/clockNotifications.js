/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

const TITLE = "LRP — On the clock";

export async function requestPersistentClockNotification(
  body,
  { silent = false } = {},
) {
  try {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }

    const registration = await navigator.serviceWorker.ready.catch((error) => {
      logError(error, {
        where: "clockNotifications",
        action: "sw-ready",
      });
      return null;
    });

    const target = navigator.serviceWorker.controller || registration?.active;
    if (!target) return;

    target.postMessage({
      type: "SHOW_CLOCK_FROM_SW",
      payload: {
        title: TITLE,
        body: String(body || ""),
        options: { silent },
      },
    });
  } catch (error) {
    logError(error, {
      where: "clockNotifications",
      action: "requestPersistent",
    });
  }
}

export async function stopPersistentClockNotification() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready.catch((error) => {
      logError(error, {
        where: "clockNotifications",
        action: "stop-ready",
      });
      return null;
    });
    const target = navigator.serviceWorker.controller || registration?.active;
    target?.postMessage({
      type: "STOP_CLOCK_STICKY",
    });
  } catch (error) {
    logError(error, {
      where: "clockNotifications",
      action: "stopPersistent",
    });
  }
}

export async function clearClockNotification() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready.catch((error) => {
      logError(error, {
        where: "clockNotifications",
        action: "clear-ready",
      });
      return null;
    });
    const target = navigator.serviceWorker.controller || registration?.active;
    target?.postMessage({
      type: "CLEAR_CLOCK_FROM_SW",
    });
  } catch (error) {
    logError(error, { where: "clockNotifications", action: "clear" });
  }
}
