self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.skipWaiting();
      } catch (error) {
        console.error("[LRP][SW] install error", error);
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
        console.error("[LRP][SW] activate error", error);
      }
    })(),
  );
});

const ICON_PATH = "/icons/icon-192.png";

self.addEventListener("push", (event) => {
  console.log(
    "[LRP][SW] push event:",
    event?.data ? event.data.text() : "(no data)",
  );
  event.waitUntil(
    (async () => {
      const data = event.data ? event.data.json() : {};
      const title =
        data?.notification?.title || data?.title || "Lake Ride Pros";
      const body =
        data?.notification?.body ||
        data?.body ||
        "You have a new notification.";
      await self.registration.showNotification(title, {
        body,
        icon: ICON_PATH,
        badge: ICON_PATH,
        data,
        vibrate: [100, 50, 100],
      });
    })(),
  );
});

async function postClockoutRequest() {
  try {
    const response = await fetch("/api/clockout", {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch (readError) {
        console.warn("[LRP][SW] clockout response read failed", readError);
      }
      const suffix = detail ? ` — ${detail}` : "";
      throw new Error(
        `Clock out failed: ${response.status} ${response.statusText}${suffix}`,
      );
    }
    return true;
  } catch (error) {
    console.error("[LRP][SW] clockout request failed", error);
    return false;
  }
}

async function broadcastToClients(message) {
  try {
    const clientsList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const client of clientsList) {
      try {
        client.postMessage(message);
      } catch (error) {
        console.warn("[LRP][SW] postMessage failed", error);
      }
    }
  } catch (error) {
    console.error("[LRP][SW] broadcast failed", error);
  }
}

async function focusExistingClientOrOpen(path) {
  const normalizedPath = typeof path === "string" ? path : "/";
  const clientsList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const targetUrl = new URL(normalizedPath, self.registration.scope).href;
  const matchingClient = clientsList.find((client) => {
    try {
      const url = client.url || "";
      return (
        url === targetUrl ||
        url.startsWith(`${targetUrl}?`) ||
        url.startsWith(`${targetUrl}#`)
      );
    } catch (error) {
      console.warn("[LRP][SW] match client failed", error);
      return false;
    }
  });
  if (matchingClient) {
    if (typeof matchingClient.focus === "function") {
      await matchingClient.focus();
    }
    return matchingClient;
  }
  const newClient = await self.clients.openWindow(normalizedPath);
  if (newClient && typeof newClient.focus === "function") {
    await newClient.focus();
  }
  return newClient;
}

self.addEventListener("notificationclick", (event) => {
  const { action } = event;
  event.notification.close();
  event.waitUntil(
    (async () => {
      try {
        if (action === "clockout") {
          const success = await postClockoutRequest();
          if (success) {
            try {
              const confirmations = await self.registration.getNotifications({
                tag: "lrp-timeclock",
              });
              confirmations.forEach((notification) => notification.close());
              await self.registration.showNotification("Clocked Out ✅", {
                body: "Your shift has been ended.",
                tag: "lrp-timeclock-confirm",
                silent: true,
                icon: ICON_PATH,
                badge: ICON_PATH,
              });
            } catch (notificationError) {
              console.error(
                "[LRP][SW] clockout confirmation failed",
                notificationError,
              );
            }
          } else {
            await self.registration.showNotification("Clock Out Failed ❌", {
              body: "We couldn't confirm your clock out. Please retry from the clock page.",
              tag: "lrp-timeclock-error",
              icon: ICON_PATH,
              badge: ICON_PATH,
            });
          }
          await broadcastToClients({ type: "SW_CLOCK_OUT_REQUEST" });
          await focusExistingClientOrOpen("/timeclock");
          return;
        }

        const clientsList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        if (clientsList.length) {
          const [primary] = clientsList;
          if (typeof primary.focus === "function") {
            await primary.focus();
          }
          return;
        }
        await self.clients.openWindow("/");
      } catch (err) {
        console.error("[LRP][SW] notificationclick failed", err);
      }
    })(),
  );
});
