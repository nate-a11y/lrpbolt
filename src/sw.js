/* eslint-env serviceworker */
/* Proprietary and confidential. See LICENSE. */
/**
 * Workbox injectManifest SW with safe defaults.
 * - Precaches ONLY files Vite built (via __WB_MANIFEST).
 * - Cleans old caches to avoid 404s on hashed bundles.
 * - NO runtime route hijacking beyond static assets.
 * - Integrates Firebase Messaging background handler.
 */
self.__LRP_BUILD_ID = (self.__LRP_BUILD_ID || 0) + 1;
console.log("[LRP SW] build", self.__LRP_BUILD_ID);

self.addEventListener("install", () => {
  try {
    self.skipWaiting();
  } catch (error) {
    console.warn("[LRP SW] skipWaiting failed", error);
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        if (self.clients) {
          await self.clients.claim();
        }
      } catch (error) {
        console.warn("[LRP SW] clients.claim failed", error);
      }
    })(),
  );
});
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

// ---- SW lifecycle: update promptly but safely
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// ---- Precache only what the build says exists
// __WB_MANIFEST is injected at build time by vite-plugin-pwa (injectManifest)
precacheAndRoute(self.__WB_MANIFEST || [], {
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
});

// ---- Light runtime cache for same-origin scripts/styles/images
registerRoute(
  ({ request }) => ["script", "style", "image"].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: "lrp-assets" }),
);

/**
 * ---- Firebase Cloud Messaging background notifications ----
 * We use compat builds via importScripts because SW cannot use ESM modules.
 * IMPORTANT: Use the SAME Firebase config as in app code.
 * Inject these values at build time using Vite env variables.
 */
function resolveEnv(primary, aliases = []) {
  const keys = [primary, ...aliases];
  for (const key of keys) {
    const value = import.meta?.env?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

try {
  const apiKey = resolveEnv("VITE_FB_API_KEY", ["VITE_FIREBASE_API_KEY"]);
  const projectId = resolveEnv("VITE_FB_PROJECT_ID", [
    "VITE_FIREBASE_PROJECT_ID",
  ]);
  const appId = resolveEnv("VITE_FB_APP_ID", ["VITE_FIREBASE_APP_ID"]);
  const messagingSenderId = resolveEnv("VITE_FB_MESSAGING_SENDER_ID", [
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_SENDER_ID",
  ]);

  if (apiKey && projectId && appId && messagingSenderId) {
    importScripts(
      "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js",
    );
    importScripts(
      "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js",
    );

    const authDomain =
      resolveEnv("VITE_FB_AUTH_DOMAIN", ["VITE_FIREBASE_AUTH_DOMAIN"]) ||
      `${projectId}.firebaseapp.com`;
    const storageBucket =
      resolveEnv("VITE_FB_STORAGE_BUCKET", ["VITE_FIREBASE_STORAGE_BUCKET"]) ||
      `${projectId}.appspot.com`;
    const measurementId = resolveEnv("VITE_FB_MEASUREMENT_ID", [
      "VITE_FIREBASE_MEASUREMENT_ID",
    ]);

    const firebaseConfig = {
      apiKey,
      projectId,
      appId,
      messagingSenderId,
      authDomain,
      storageBucket,
      ...(measurementId ? { measurementId } : {}),
    };

    self.firebase.initializeApp(firebaseConfig);

    const messaging = self.firebase.messaging();

    // Background message handler
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
  } else {
    console.warn(
      "[SW] FCM init skipped: missing Firebase config (apiKey, projectId, appId, messagingSenderId)",
    );
  }
} catch (e) {
  // Do not crash SW if FCM not configured
  console.warn("[SW] FCM init skipped or failed:", e);
}

self.addEventListener("notificationclick", (event) => {
  const action = event.action;
  const notification = event.notification;
  event.waitUntil(
    (async () => {
      try {
        const allClients = await clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        const client =
          allClients[0] ||
          (typeof clients.openWindow === "function"
            ? await clients.openWindow("/")
            : null);
        if (client && "focus" in client) {
          try {
            await client.focus();
          } catch (focusError) {
            console.warn("[SW] focus failed", focusError);
          }
        }
        if (action === "clock_out") {
          client?.postMessage?.({ type: "LRP_CLOCK_OUT_REQUEST" });
        } else {
          client?.postMessage?.({ type: "LRP_OPEN_CLOCK" });
        }
      } catch (error) {
        console.error("[SW] notificationclick error", error);
      } finally {
        try {
          notification.close();
        } catch (closeError) {
          console.warn("[SW] notification close failed", closeError);
        }
      }
    })(),
  );
});
