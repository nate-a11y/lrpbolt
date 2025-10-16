/* Proprietary and confidential. See LICENSE. */
/* global self */
const SW_VERSION = "lrp-sw-v17";
let CLOCK_STICKY = false;

// Scope-relative URL builder
function scopeUrl(path) {
  try { return new URL(String(path || "").replace(/^\//, ""), self.registration.scope).href; } catch (_) { return path; }
}

self.addEventListener("fetch", (event) => {
  try {
    const url = new URL(event.request.url);
    if (
      url.hostname.endsWith("googleapis.com") &&
      (url.pathname.includes("/Firestore/Listen/") ||
        url.pathname.includes("/v1/token"))
    ) {
      return;
    }
  } catch (error) {
    // Swallow silently to avoid console noise; diagnostics handled elsewhere.
  }
});

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    (async () => {
      try {
        if (typeof self.skipWaiting === "function") {
          await self.skipWaiting();
        }
      } catch (e) {
        console.error("[sw] install", e);
      }
    })(),
  );
});
self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    (async () => {
      try {
        if (self.clients?.claim) {
          await self.clients.claim();
        }
      } catch (e) {
        console.error("[sw] activate", e);
      }
    })(),
  );
});

// ---- Messaging ----
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === "PING") {
      if (event.ports && event.ports[0]) {
        try { event.ports[0].postMessage({ type: "PONG", v: SW_VERSION, scope: self.registration.scope }); } catch (e) { console.error(e); }
      }
      return;
    }
    if (msg.type === "DIAG_NOTIFY") {
      const body = msg?.payload?.body || "SW diagnostic";
      event.waitUntil(self.registration.showNotification("LRP — SW Diagnostic", {
        body,
        tag: "lrp-diag",
        renotify: true,
        requireInteraction: true,
        badge: scopeUrl("icons/icon-192.png"),
        icon: scopeUrl("icons/icon-192.png"),
        actions: [{ action: "open", title: "Open" }],
        data: { ts: Date.now(), diag: true },
      }));
      return;
    }
    if (msg.type === "SHOW_CLOCK_FROM_SW") {
      CLOCK_STICKY = true;
      const { title, body } = msg.payload || {};
      event.waitUntil(showClockNotificationFromSW(title || "LRP — On the clock", body || ""));
      return;
    }
    if (msg.type === "STOP_CLOCK_STICKY") { CLOCK_STICKY = false; event.waitUntil(closeClockNotifications()); return; }
    if (msg.type === "CLEAR_CLOCK_FROM_SW") { event.waitUntil(closeClockNotifications()); return; }

    // ---- FCM lazy init with waitUntil + ACK ----
    if (msg.type === "FIREBASE_CONFIG") {
      const cfg = msg?.payload?.config || null;
      const ackPort = event.ports && event.ports[0];
      const initPromise = (async () => {
        try {
          importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
          importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
          if (cfg && (!self.firebase?.apps?.length)) self.firebase.initializeApp(cfg);
          if (self.firebase?.apps?.length) {
            const messaging = self.firebase.messaging();
            messaging.onBackgroundMessage(async (payload) => {
              try {
                if (payload?.notification) return;
                const title =
                  payload?.data?.title ||
                  payload?.data?.body ||
                  "LRP — Update";
                const body = payload?.data?.body || "";
                await self.registration.showNotification(title, {
                  body,
                  tag: "lrp-fcm",
                  renotify: true,
                  badge: scopeUrl("icons/icon-192.png"),
                  icon: scopeUrl("icons/icon-192.png"),
                  actions: [
                    { action: "open", title: "Open" },
                    { action: "clockout", title: "Clock Out" },
                  ],
                  data: { ts: Date.now(), fcm: true, payload },
                });
              } catch (e) {
                console.error("[sw] onBackgroundMessage show failed", e);
              }
            });
          }
          if (ackPort) { try { ackPort.postMessage({ type: "FIREBASE_CONFIG_ACK", ok: true, v: SW_VERSION }); } catch (e) { console.error(e); } }
        } catch (e) {
          console.error("[sw] FCM init failed", e);
          if (ackPort) { try { ackPort.postMessage({ type: "FIREBASE_CONFIG_ACK", ok: false, err: String(e?.message || e), v: SW_VERSION }); } catch (err) { console.error(err); } }
        }
      })();
      event.waitUntil(initPromise);
      return;
    }
  } catch (e) { console.error("[sw] message error", e); }
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const raw = event.data ? (() => {
          try { return event.data.json(); } catch (err) { return { body: event.data.text?.() }; }
        })() : {};
        const notification = raw?.notification || {};
        const title =
          notification.title ||
          raw?.title ||
          raw?.body ||
          "LRP Driver Portal";
        const body = notification.body || raw?.body || "";
        const icon = notification.icon || scopeUrl("icons/icon-192.png");
        const badge = notification.badge || scopeUrl("icons/icon-192.png");
        const tag = notification.tag || raw?.tag || "lrp-fcm";
        await self.registration.showNotification(title, {
          body,
          icon,
          badge,
          tag,
          renotify: true,
          vibrate: [100, 50, 100],
          data: raw?.data || raw,
        });
      } catch (error) {
        console.error("[sw] push handler error", error);
      }
    })(),
  );
});

// Sticky on-the-clock
async function showClockNotificationFromSW(title, body) {
  try {
    await self.registration.showNotification(title, {
      body,
      tag: "lrp-clock",
      renotify: true,
      requireInteraction: true,
      badge: scopeUrl("icons/icon-192.png"),
      icon: scopeUrl("icons/icon-192.png"),
      actions: [{ action: "open", title: "Open" }, { action: "clockout", title: "Clock Out" }],
      data: { ts: Date.now(), sticky: true },
    });
  } catch (e) { console.error("[sw] showNotification failed", e); }
}
async function closeClockNotifications() {
  try {
    const list = await self.registration.getNotifications({ tag: "lrp-clock" });
    list.forEach((n) => n.close());
  } catch (e) { console.error("[sw] closeClockNotifications failed", e); }
}
self.addEventListener("notificationclose", (event) => {
  const sticky = Boolean(event.notification?.data?.sticky);
  if (CLOCK_STICKY && sticky) {
    event.waitUntil(showClockNotificationFromSW("LRP — On the clock", ""));
  }
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
        console.warn("[sw] clockout response read failed", readError);
      }
      const suffix = detail ? ` — ${detail}` : "";
      throw new Error(
        `Clock out failed: ${response.status} ${response.statusText}${suffix}`,
      );
    }
    return true;
  } catch (error) {
    console.error("[sw] clockout request failed", error);
    return false;
  }
}

async function broadcastToClients(message) {
  try {
    const all = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const client of all) {
      try {
        client.postMessage(message);
      } catch (error) {
        console.warn("[sw] postMessage failed", error);
      }
    }
  } catch (error) {
    console.error("[sw] broadcast failed", error);
  }
}

async function focusOrOpen(path = "/") {
  const normalizedPath = typeof path === "string" && path ? path : "/";
  try {
    const all = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    const targetHref = new URL(normalizedPath, self.registration.scope).href;
    const existing = all.find((client) => {
      try {
        const url = client.url || "";
        return (
          url === targetHref ||
          url.startsWith(`${targetHref}?`) ||
          url.startsWith(`${targetHref}#`)
        );
      } catch (error) {
        console.warn("[sw] client url compare failed", error);
        return false;
      }
    });

    if (!existing && all.length && normalizedPath === "/") {
      const [first] = all;
      if (first && typeof first.focus === "function") {
        try {
          await first.focus();
        } catch (focusError) {
          console.warn("[sw] focus failed", focusError);
        }
      }
      return first || null;
    }

    if (existing) {
      if (typeof existing.focus === "function") {
        try {
          await existing.focus();
        } catch (focusExistingError) {
          console.warn("[sw] focus existing failed", focusExistingError);
        }
      }
      if (typeof existing.navigate === "function") {
        try {
          await existing.navigate(normalizedPath);
        } catch (navigateError) {
          console.warn("[sw] navigate existing failed", navigateError);
        }
      }
      return existing;
    }

    if (self.clients?.openWindow) {
      const created = await self.clients.openWindow(normalizedPath);
      if (created && typeof created.focus === "function") {
        try {
          await created.focus();
        } catch (createdFocusError) {
          console.warn("[sw] focus new window failed", createdFocusError);
        }
      }
      return created;
    }
  } catch (error) {
    console.error("[sw] focusOrOpen failed", error);
  }
  return null;
}

self.addEventListener("notificationclick", (event) => {
  const action = event.action || "";
  event.notification?.close();
  event.waitUntil(
    (async () => {
      try {
        if (action === "clockout") {
          const [success, targetClient] = await Promise.all([
            postClockoutRequest(),
            focusOrOpen("/clock"),
          ]);
          if (!success) {
            await self.registration.showNotification("Clock Out Failed ❌", {
              body: "We couldn't confirm your clock out. Please retry from the clock page.",
              tag: "lrp-timeclock-error",
              icon: scopeUrl("icons/icon-192.png"),
              badge: scopeUrl("icons/icon-192.png"),
            });
          }
          if (targetClient) {
            try {
              targetClient.postMessage({ type: "SW_CLOCK_OUT_REQUEST" });
            } catch (postError) {
              console.warn("[sw] direct clockout postMessage failed", postError);
            }
          }
          await broadcastToClients({ type: "SW_CLOCK_OUT_REQUEST" });
          return;
        }

        const target = event.notification?.data?.url || "/";
        await focusOrOpen(target);
      } catch (e) {
        console.error("[sw] notificationclick error", e);
        await focusOrOpen("/");
      }
    })(),
  );
});
