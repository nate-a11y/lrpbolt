/* Proprietary and confidential. See LICENSE. */
const SW_VERSION = "lrp-sw-v10";
let CLOCK_STICKY = false;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        self.skipWaiting();
      } catch (error) {
        console.error("[sw] install", error);
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch (error) {
        console.error("[sw] activate", error);
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === "PING") return;
    if (msg.type === "SHOW_CLOCK_FROM_SW") {
      CLOCK_STICKY = true;
      const { title, body } = msg.payload || {};
      event.waitUntil(
        showClockNotificationFromSW(title || "LRP — On the clock", body || ""),
      );
      return;
    }
    if (msg.type === "STOP_CLOCK_STICKY") {
      CLOCK_STICKY = false;
      event.waitUntil(closeClockNotifications());
      return;
    }
    if (msg.type === "CLEAR_CLOCK_FROM_SW") {
      event.waitUntil(closeClockNotifications());
    }
  } catch (error) {
    console.error("[sw] message error", error);
  }
});

async function showClockNotificationFromSW(title, body) {
  try {
    await self.registration.showNotification(title, {
      body,
      tag: "lrp-clock",
      renotify: true,
      requireInteraction: true,
      badge: "/icons/badge-72.png",
      icon: "/icons/icon-192.png",
      actions: [
        { action: "open", title: "Open" },
        { action: "clockout", title: "Clock Out" },
      ],
      data: { ts: Date.now(), sticky: true, version: SW_VERSION },
    });
  } catch (error) {
    console.error("[sw] showNotification failed", error);
  }
}

async function closeClockNotifications() {
  try {
    const list = await self.registration.getNotifications({ tag: "lrp-clock" });
    list.forEach((notification) => notification.close());
  } catch (error) {
    console.error("[sw] closeClockNotifications failed", error);
  }
}

self.addEventListener("notificationclose", (event) => {
  const sticky = Boolean(event.notification?.data?.sticky);
  if (CLOCK_STICKY && sticky) {
    event.waitUntil(showClockNotificationFromSW("LRP — On the clock", ""));
  }
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action || "";
  event.notification?.close();

  event.waitUntil(
    (async () => {
      try {
        const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const scopeUrl = new URL(self.registration.scope);
        const client =
          all.find((c) => c.url.startsWith(scopeUrl.origin)) ||
          (await self.clients.openWindow(scopeUrl.href));
        if (!client) return;

        if (action === "clockout") {
          client.postMessage({ type: "SW_CLOCK_OUT_REQUEST" });
        } else {
          client.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
        }

        if ("focus" in client) await client.focus();
      } catch (error) {
        console.error("[sw] notificationclick error", error);
      }
    })(),
  );
});
