import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkOnly, StaleWhileRevalidate } from "workbox-strategies";

self.skipWaiting();
clientsClaim();

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanupOutdatedCaches());
});

const precacheManifest = (self.__WB_MANIFEST || []).filter((entry, index, arr) => {
  const url = entry?.url?.split("?")[0];
  const valid = entry?.url && entry?.revision && url !== "/login" && !url.includes("/__/auth/handler");
  if (!valid) {
    console.warn("[SW] Skipping precache entry", entry);
  }
  return valid && index === arr.findIndex((e) => e.url.split("?")[0] === url);
});

precacheAndRoute(precacheManifest, {
  plugins: [
    {
      fetchDidFail: async ({ request }) => {
        console.error("[SW] Precaching failed for", request.url);
      },
    },
  ],
});

setCatchHandler(({ event }) => {
  console.error("[SW] Fetch failed for", event.request.url);
  return Response.error();
});

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
