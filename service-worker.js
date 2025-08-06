import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute } from "workbox-routing";
import { NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";

self.skipWaiting();
clientsClaim();

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanupOutdatedCaches());
});

const precacheManifest = self.__WB_MANIFEST.filter(
  (entry) =>
    entry.url !== "/login" && !entry.url.includes("/__/auth/handler"),
);
precacheAndRoute(precacheManifest);

// Avoid caching login page and Firebase auth handler so users always see fresh auth UI
registerRoute(
  ({ url }) =>
    url.pathname.includes('/__/auth/handler') || url.pathname === '/login',
  new NetworkOnly(),
);

// Runtime caching for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api'),
  new StaleWhileRevalidate(),
);
