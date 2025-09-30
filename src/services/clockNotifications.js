/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

/**
 * Show/update a persistent notification while the user is clocked in.
 * Uses the Notifications API (foreground) and the service worker (background).
 */
// Safe to call periodically (e.g. every 60s) — replaces existing notification silently
export async function showPersistentClockNotification({ elapsedLabel } = {}) {
  try {
    if (!("serviceWorker" in navigator)) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;

    await reg.showNotification("On the clock ⏱", {
      body: elapsedLabel
        ? `Elapsed: ${elapsedLabel}`
        : "Tap to view or Clock Out",
      tag: "lrp-timeclock",
      renotify: false,
      silent: true,
      requireInteraction: true,
      badge: "/icons/icon-192.png",
      icon: "/icons/icon-192.png",
      data: { type: "timeclock" },
      actions: [
        {
          action: "clockout",
          title: "Clock Out",
        },
      ],
    });
  } catch (error) {
    logError(error, {
      where: "showPersistentClockNotification",
      action: "show",
    });
  }
}

export async function clearPersistentClockNotification() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const notifications = await reg.getNotifications({ tag: "lrp-timeclock" });
    for (const notification of notifications) {
      notification.close();
    }
    if (navigator.clearAppBadge) {
      await navigator.clearAppBadge();
    }
  } catch (error) {
    logError(error, {
      where: "clearPersistentClockNotification",
      action: "clear",
    });
  }
}
