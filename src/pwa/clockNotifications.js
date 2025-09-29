/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

const TITLE = "LRP — On the clock";

export async function requestPersistentClockNotification(
  body,
  { silent = false } = {},
) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration?.showNotification) return;

    await registration.showNotification(TITLE, {
      body: String(body || ""),
      tag: "lrp-clock",
      renotify: false,
      requireInteraction: true,
      silent,
      badge: "/icons/icon-192.png",
      icon: "/icons/icon-192.png",
      data: { kind: "clock" },
      actions: [
        { action: "open", title: "Open" },
        { action: "clock_out", title: "Clock Out" },
      ],
    });
  } catch (error) {
    logError(error, {
      where: "clockNotifications",
      action: "showNotification",
    });
  }
}

export async function clearClockNotification() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const notifications = await registration?.getNotifications({
      tag: "lrp-clock",
    });
    await Promise.all(
      (notifications || []).map((notification) => notification.close()),
    );
  } catch (error) {
    logError(error, { where: "clockNotifications", action: "clear" });
  }
}
