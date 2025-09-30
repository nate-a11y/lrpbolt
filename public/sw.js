/* Proprietary and confidential. See LICENSE. */
const SW_VERSION = "lrp-sw-v11";
let CLOCK_STICKY = false;
let firebaseInitPromise = null;
let firebaseMessagingReady = false;
let cachedFirebaseConfig = null;

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
        await cache.addAll(PRECACHE_URLS);
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
      return;
    }
    if (msg.type === "FIREBASE_CONFIG" && msg.config) {
      cachedFirebaseConfig = msg.config;
      event.waitUntil(ensureFirebaseMessagingInitialized(msg.config));
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
        const all = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
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

async function ensureFirebaseMessagingInitialized(config) {
  if (!config) return;
  if (firebaseMessagingReady) return;
  if (firebaseInitPromise) {
    try {
      await firebaseInitPromise;
    } catch (error) {
      console.error("[sw] firebase init retry failed", error);
    }
    return;
  }
  firebaseInitPromise = (async () => {
    try {
      importScripts(
        "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",
      );
      importScripts(
        "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js",
      );

      if (!self.firebase?.apps?.length) {
        self.firebase.initializeApp(config);
      }
      const messaging = self.firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title = payload?.notification?.title || "Notification";
        const body = payload?.notification?.body || "";
        const icon = payload?.notification?.icon || "/favicon.ico";
        self.registration.showNotification(title, {
          body,
          icon,
          data: payload?.data || {},
        });
      });
      firebaseMessagingReady = true;
    } catch (error) {
      firebaseMessagingReady = false;
      console.error("[sw] FCM init failed", error);
      throw error;
    }
  })();
  try {
    await firebaseInitPromise;
  } catch (error) {
    firebaseInitPromise = null;
  }
}

self.addEventListener("push", (event) => {
  if (!cachedFirebaseConfig) return;
  // Ensure FCM is ready for background pushes triggered before message event.
  event.waitUntil(ensureFirebaseMessagingInitialized(cachedFirebaseConfig));
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
              (await cache.match(request)) || (await cache.match("/index.html"));
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
