/* eslint-disable no-undef */
// Firebase Messaging SW: receives background pushes + handles clock-out taps.
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

self.__LRP_FCM_SW__ = true;

let messagingInstance = null;
let cachedConfig = null;

function ensureMessaging() {
  if (messagingInstance) return messagingInstance;
  try {
    if (typeof firebase === "undefined") return null;
    if (!firebase.apps?.length && cachedConfig) {
      firebase.initializeApp(cachedConfig);
    }
    messagingInstance = firebase.messaging();
    return messagingInstance;
  } catch (error) {
    console.warn("[LRP][FCM][SW] messaging init failed", error);
    messagingInstance = null;
    return null;
  }
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "FIREBASE_CONFIG") return;

  const ackPort = event.ports && event.ports[0];
  try {
    const incomingConfig = data?.payload?.config;
    if (incomingConfig) {
      cachedConfig = incomingConfig;
    }
    const instance = ensureMessaging();
    if (ackPort) {
      ackPort.postMessage({
        type: "FIREBASE_CONFIG_ACK",
        ok: Boolean(instance),
        v: "lrp-fcm-sw-v2",
      });
    }
  } catch (error) {
    console.error("[LRP][FCM][SW] config message failed", error);
    if (ackPort) {
      try {
        ackPort.postMessage({
          type: "FIREBASE_CONFIG_ACK",
          ok: false,
          err: String(error?.message || error),
          v: "lrp-fcm-sw-v2",
        });
      } catch (postError) {
        console.error("[LRP][FCM][SW] ack post failed", postError);
      }
    }
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Keep the SW alive long enough for install completion.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.clients?.claim) {
        try {
          await self.clients.claim();
        } catch (error) {
          console.warn("[LRP][FCM][SW] claim failed", error);
        }
      }
    })(),
  );
});

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
        if (action === "clockout" || payload.action === "clockout") {
          const notifyClients = async (type, extra = {}) => {
            try {
              const targets = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
              });
              targets.forEach((client) => {
                try {
                  client.postMessage({ type, ...extra });
                } catch (postError) {
                  console.warn("[LRP][FCM][SW] postMessage failed", postError);
                }
              });
            } catch (clientError) {
              console.warn("[LRP][FCM][SW] notifyClients failed", clientError);
            }
          };

          if (payload?.clockoutUrl) {
            try {
              const response = await fetch(payload.clockoutUrl, {
                method: "POST",
                credentials: "include",
              });
              if (!response?.ok) {
                throw new Error(`clockout_failed_${response?.status || "unknown"}`);
              }
              await notifyClients("CLOCKOUT_OK");
              await focusOrOpen("/timeclock");
              return;
            } catch (fetchError) {
              console.warn("[LRP][FCM][SW] clockout fetch failed", fetchError);
              await notifyClients("CLOCKOUT_FAILED", {
                error: fetchError?.message || "clockout_failed",
              });
              await focusOrOpen("/timeclock");
              return;
            }
          }

          await notifyClients("CLOCKOUT_FAILED", { error: "missing_url" });
          await focusOrOpen("/timeclock");
          return;
        }

        const target = payload?.url || "/";
        await focusOrOpen(target);
      } catch (error) {
        console.error("[LRP][FCM][SW] notificationclick fallback", error);
        await focusOrOpen("/");
      }
    })(),
  );
});

ensureMessaging();
