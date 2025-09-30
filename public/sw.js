/* Proprietary and confidential. See LICENSE. */

const SW_VERSION = "lrp-sw-v14";
let CLOCK_STICKY = false;

function scopeUrl(path) {
  try {
    const base = self.registration.scope;
    const clean = String(path || "").replace(/^\//, "");
    return new URL(clean, base).href;
  } catch (error) {
    console.error("[sw] scopeUrl failed", error);
    return path;
  }
}

/* ---------- FCM lazy init ---------- */
let _fcmReady = false;
let _fcmInitErr = null;

async function initFirebaseMessagingInSw(config) {
  if (_fcmReady) return true;
  try {
    importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

    if (!self.firebase?.apps?.length) {
      self.firebase.initializeApp(config);
    }

    const messaging = self.firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      try {
        const title =
          (payload?.notification &&
            (payload.notification.title || payload.notification.body)) ||
          "LRP — Update";
        const body = (payload?.notification && payload.notification.body) || "";
        self.registration.showNotification(title, {
          body,
          tag: "lrp-fcm",
          renotify: true,
          badge: scopeUrl("icons/badge-72.png"),
          icon: scopeUrl("icons/icon-192.png"),
          actions: [
            { action: "open", title: "Open" },
            { action: "clockout", title: "Clock Out" },
          ],
          data: { ts: Date.now(), fcm: true },
        });
      } catch (error) {
        console.error("[sw] onBackgroundMessage show failed", error);
      }
    });

    _fcmReady = true;
    _fcmInitErr = null;
    return true;
  } catch (error) {
    _fcmInitErr = String(error?.message || error);
    console.error("[sw] FCM init failed", error);
    return false;
  }
}

/* ---------- Minimal offline cache (no Workbox) ---------- */
const CACHE_NAME = "lrp-offline-v1";
const RUNTIME_CACHE = "lrp-runtime-v1";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/badge-72.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.skipWaiting();
      } catch (error) {
        console.error("[sw] install", error);
      }
      try {
        const cache = await caches.open(CACHE_NAME);
        const scoped = PRECACHE_URLS.map((url) => scopeUrl(url));
        await cache.addAll(scoped);
      } catch (error) {
        console.error("[sw] precache failed", error);
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
      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        clients.forEach((client) => {
          try {
            client.postMessage({
              type: "SW_READY",
              v: SW_VERSION,
              scope: self.registration.scope,
            });
          } catch (err) {
            console.error("[sw] SW_READY notify failed", err);
          }
        });
      } catch (error) {
        console.error("[sw] SW_READY broadcast failed", error);
      }
      try {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name)),
        );
      } catch (error) {
        console.error("[sw] cache cleanup failed", error);
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === "FIREBASE_CONFIG") {
      const cfg = msg?.payload?.config || msg.config || null;
      const ackPort = event.ports && event.ports[0];
      const initPromise = (async () => {
        let ok = false;
        if (cfg) {
          ok = await initFirebaseMessagingInSw(cfg);
        } else {
          _fcmInitErr = "Missing Firebase config";
        }
        if (ackPort) {
          try {
            ackPort.postMessage({
              type: "FIREBASE_CONFIG_ACK",
              ok,
              err: _fcmInitErr,
              v: SW_VERSION,
            });
          } catch (error) {
            console.error("[sw] FIREBASE_CONFIG ack failed", error);
          }
        }
      })();
      event.waitUntil(initPromise);
      return;
    }
    if (msg.type === "PING") {
      const response = { type: "PONG", v: SW_VERSION, scope: self.registration.scope };
      if (event.ports && event.ports[0]) {
        try {
          event.ports[0].postMessage(response);
        } catch (error) {
          console.error("[sw] PONG port reply failed", error);
        }
      }
      try {
        event.source?.postMessage?.(response);
      } catch (error) {
        console.error("[sw] PONG source reply failed", error);
      }
      return;
    }
    if (msg.type === "DIAG_NOTIFY") {
      const body = (msg && msg.payload && msg.payload.body) || "SW diagnostic";
      event.waitUntil(
        (async () => {
          try {
            await self.registration.showNotification("LRP — SW Diagnostic", {
              body,
              tag: "lrp-diag",
              renotify: true,
              requireInteraction: true,
              badge: scopeUrl("icons/badge-72.png"),
              icon: scopeUrl("icons/icon-192.png"),
              actions: [{ action: "open", title: "Open" }],
              data: { ts: Date.now(), diag: true },
            });
          } catch (error) {
            console.error("[sw] diag notify failed", error);
          }
        })(),
      );
      return;
    }
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
      return;
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
      badge: scopeUrl("icons/badge-72.png"),
      icon: scopeUrl("icons/icon-192.png"),
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
        const all = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const scopeHref = self.registration.scope;
        const client =
          all.find((c) => c.url.startsWith(scopeHref)) ||
          (await self.clients.openWindow(scopeHref));
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


self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const acceptsHTML = request.headers.get("accept")?.includes("text/html");
  if (acceptsHTML) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
          } catch (error) {
            console.error("[sw] cache put failed", error);
          }
          return networkResponse;
        } catch (networkError) {
          try {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse =
              (await cache.match(request)) ||
              (await cache.match(scopeUrl("index.html")));
            if (cachedResponse) return cachedResponse;
          } catch (cacheError) {
            console.error("[sw] html cache fallback failed", cacheError);
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  if (/\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cachedResponse = await cache.match(request);
        try {
          const networkResponse = await fetch(request);
          try {
            await cache.put(request, networkResponse.clone());
          } catch (error) {
            console.error("[sw] runtime cache put failed", error);
          }
          return networkResponse;
        } catch (networkError) {
          if (cachedResponse) return cachedResponse;
          throw networkError;
        }
      })(),
    );
  }
});
