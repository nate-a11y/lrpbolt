/* LRP Portal enhancement: FCM SW hardening, 2025-10-03.
   Rationale: waitUntil guards, closed-app notificationclick behavior, stable actions. */
self.__LRP_FCM_SW__ = true;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // no-op caching here; but keep alive to ensure clean install
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Claim clients so notificationclick can message right away
      if (self.clients && self.clients.claim) {
        try {
          await self.clients.claim();
        } catch (error) {
          console.warn("[LRP][FCM][SW] claim failed", error);
        }
      }
    })(),
  );
});

/** Helper: focus or open a client */
async function focusOrOpen(url = "/") {
  try {
    const allClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    const client = allClients.find((c) => typeof c.focus === "function");
    if (client) {
      try {
        await client.focus();
      } catch (focusError) {
        console.warn("[LRP][FCM][SW] focus failed", focusError);
      }
      if (typeof client.navigate === "function") {
        try {
          await client.navigate(url);
        } catch (navError) {
          console.warn("[LRP][FCM][SW] navigate failed", navError);
        }
      }
      return client;
    }
    if (self.clients && typeof self.clients.openWindow === "function") {
      try {
        return await self.clients.openWindow(url);
      } catch (openError) {
        console.warn("[LRP][FCM][SW] openWindow failed", openError);
      }
    }
  } catch (error) {
    console.error("[LRP][FCM][SW] focusOrOpen failed", error);
  }
  return null;
}

/** Optional: handle raw 'push' if you send data messages without FCM SDK */
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const data = event.data ? event.data.json() : {};
        if (!data?.notification && !data?.title) return;
        const title = data.notification?.title || data.title || "Lake Ride Pros";
        const options = {
          body: data.notification?.body || data.body || "",
          icon: data.notification?.icon || "/icons/icon-192.png",
          badge: data.notification?.badge || "/icons/icon-192.png",
          data: data.data || {},
          actions: data.actions || [],
        };
        await self.registration.showNotification(title, options);
      } catch (error) {
        console.error("[LRP][FCM][SW] push handler failed", error);
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action || event.notification?.data?.action || "";
  const payload = event.notification?.data || {};
  event.waitUntil(
    (async () => {
      try {
        // Action: clockout (perform server call OR open app then message)
        if (action === "clockout" || payload.action === "clockout") {
          // Attempt server-side action first (optional; keep idempotent)
          try {
            if (payload?.clockoutUrl) {
              await fetch(payload.clockoutUrl, {
                method: "POST",
                credentials: "omit",
              });
            }
          } catch (fetchError) {
            console.warn("[LRP][FCM][SW] clockout fetch failed", fetchError);
          }

          // Open/focus the time clock view for UX continuity
          await focusOrOpen("/timeclock");
          return;
        }

        // Default behavior: focus or open root (or deep link if provided)
        const target = payload?.url || "/";
        await focusOrOpen(target);
      } catch (error) {
        console.error("[LRP][FCM][SW] notificationclick fallback", error);
        // Last resort: open root
        await focusOrOpen("/");
      }
    })(),
  );
});
