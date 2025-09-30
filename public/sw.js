/* Proprietary and confidential. See LICENSE. */
const SW_VERSION = "lrp-sw-v16";
let CLOCK_STICKY = false;

// Scope-relative URL builder
function scopeUrl(path) {
  try { return new URL(String(path || "").replace(/^\//, ""), self.registration.scope).href; } catch (_) { return path; }
}

self.addEventListener("install", (evt) => {
  evt.waitUntil((async () => { try { self.skipWaiting(); } catch (e) { console.error("[sw] install", e); } })());
});
self.addEventListener("activate", (evt) => {
  evt.waitUntil((async () => { try { await self.clients.claim(); } catch (e) { console.error("[sw] activate", e); } })());
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
          importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
          importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");
          if (cfg && (!self.firebase?.apps?.length)) self.firebase.initializeApp(cfg);
          if (self.firebase?.apps?.length) {
            const messaging = self.firebase.messaging();
            messaging.onBackgroundMessage((payload) => {
              try {
                const title = (payload?.notification && (payload.notification.title || payload.notification.body)) || "LRP — Update";
                const body = (payload?.notification && payload.notification.body) || "";
                self.registration.showNotification(title, {
                  body,
                  tag: "lrp-fcm",
                  renotify: true,
                  badge: scopeUrl("icons/icon-192.png"),
                  icon: scopeUrl("icons/icon-192.png"),
                  actions: [{ action: "open", title: "Open" }, { action: "clockout", title: "Clock Out" }],
                  data: { ts: Date.now(), fcm: true },
                });
              } catch (e) { console.error("[sw] onBackgroundMessage show failed", e); }
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
self.addEventListener("notificationclick", (event) => {
  const action = event.action || "";
  event.notification?.close();
  event.waitUntil((async () => {
    try {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const scopeURL = self.registration.scope;
      const client = all.find((c) => c.url.startsWith(scopeURL)) || (await self.clients.openWindow(scopeURL));
      if (!client) return;
      client.postMessage({ type: action === "clockout" ? "SW_CLOCK_OUT_REQUEST" : "SW_OPEN_TIME_CLOCK" });
      if ("focus" in client) await client.focus();
    } catch (e) { console.error("[sw] notificationclick error", e); }
  })());
});
