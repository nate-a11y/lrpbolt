/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

/**
 * Show/update a persistent notification while the user is clocked in.
 * Uses the Notifications API (foreground) and the service worker (background).
 */
export async function showPersistentClockNotification({ formatted, startTs }) {
  try {
    if (!("serviceWorker" in navigator)) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;

    const title = "On the clock ⏱";
    const body = `Active since ${startTs?.toDate ? startTs.toDate().toLocaleTimeString() : ""}\nElapsed: ${formatted}`;
    await reg.showNotification(title, {
      body,
      tag: "lrp-timeclock",
      renotify: true,
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
