/* Proprietary and confidential. See LICENSE. */
const SW_VERSION = "lrp-sw-v8";
let CLOCK_STICKY = false;
let lastClockPayload = {
  title: "LRP — On the clock",
  body: "",
  options: {},
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        self.skipWaiting();
      } catch (error) {
        console.error("[sw] install error", error);
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
        console.error("[sw] activate error", error);
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  const message = event?.data || {};
  if (message?.type === "PING" && event.ports?.[0]) {
    event.ports[0].postMessage({ type: "PONG", v: SW_VERSION });
    return;
  }

  if (message?.type === "SHOW_CLOCK_FROM_SW") {
    CLOCK_STICKY = true;
    const payload = message?.payload || {};
    lastClockPayload = {
      title: payload?.title || "LRP — On the clock",
      body: payload?.body || "",
      options: payload?.options && typeof payload.options === "object"
        ? payload.options
        : {},
    };
    event.waitUntil(
      showClockNotificationFromSW(
        lastClockPayload.title,
        lastClockPayload.body,
        lastClockPayload.options,
      ),
    );
    return;
  }

  if (message?.type === "STOP_CLOCK_STICKY") {
    CLOCK_STICKY = false;
    event.waitUntil(closeClockNotifications());
    return;
  }

  if (message?.type === "CLEAR_CLOCK_FROM_SW") {
    event.waitUntil(closeClockNotifications());
  }
});

async function showClockNotificationFromSW(title, body, options = {}) {
  try {
    const { silent = false } = options;
    const data =
      options?.data && typeof options.data === "object" ? options.data : {};

    await self.registration.showNotification(title, {
      body,
      tag: "lrp-clock",
      renotify: true,
      requireInteraction: true,
      silent,
      badge: "/icons/badge-72.png",
      icon: "/icons/icon-192.png",
      actions: [
        { action: "open", title: "Open" },
        { action: "clockout", title: "Clock Out" },
      ],
      data: { ts: Date.now(), sticky: CLOCK_STICKY, ...data },
    });
  } catch (error) {
    console.error("[sw] showNotification failed", error);
  }
}

async function closeClockNotifications() {
  try {
    const notifications = await self.registration.getNotifications({
      tag: "lrp-clock",
    });
    notifications.forEach((notification) => {
      notification.close();
    });
  } catch (error) {
    console.error("[sw] closeClockNotifications failed", error);
  }
}

self.addEventListener("notificationclose", (event) => {
  const wasSticky = Boolean(event?.notification?.data?.sticky);
  if (!CLOCK_STICKY || !wasSticky) {
    return;
  }

  event.waitUntil(
    showClockNotificationFromSW(
      lastClockPayload.title,
      lastClockPayload.body,
      lastClockPayload.options,
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action || "";
  const notification = event.notification;
  notification?.close();

  event.waitUntil(
    (async () => {
      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const scopeUrl = new URL(self.registration.scope);
        const client =
          clients.find((item) => item.url.startsWith(scopeUrl.origin)) ||
          (await self.clients.openWindow(scopeUrl.href));

        if (!client) {
          return;
        }

        if (action === "clockout") {
          client.postMessage({ type: "SW_CLOCK_OUT_REQUEST" });
        } else {
          client.postMessage({ type: "SW_OPEN_TIME_CLOCK" });
        }

        if ("focus" in client) {
          await client.focus();
        }
      } catch (error) {
        console.error("[sw] notificationclick error", error);
      }
    })(),
  );
});
