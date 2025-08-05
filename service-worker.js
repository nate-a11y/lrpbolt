import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { clientsClaim, cacheNames } from "workbox-core";

// Manifest injected at build time.
// Vite/Workbox sometimes inject both `manifest.webmanifest` and
// `manifest.webmanifest?__WB_REVISION__=hash`, which causes the
// `add-to-cache-list-conflicting-entries` error. Normalize each URL
// (strip query parameters) and keep only the first occurrence so every
// resource, especially `manifest.webmanifest`, is cached exactly once.
const seen = new Set();
const manifest = [];
for (const entry of self.__WB_MANIFEST) {
  const cleanUrl = entry.url.split("?")[0];
  if (seen.has(cleanUrl)) continue;
  seen.add(cleanUrl);
  manifest.push({ ...entry, url: cleanUrl });
}

precacheAndRoute(manifest);

// Remove any previously cached entries that differ only by query string.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheNames.precache);
      const requests = await cache.keys();
      const normalized = new Set();
      await Promise.all(
        requests.map(async (req) => {
          const url = new URL(req.url);
          const key = url.origin + url.pathname;
          if (normalized.has(key)) {
            await cache.delete(req);
          } else {
            normalized.add(key);
          }
        }),
      );
    })(),
  );
});

// Log any failed precache fetches to help diagnose missing chunks
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      for (const { url } of manifest) {
        try {
          const resp = await fetch(url);
          if (!resp.ok) {
            console.error("Precache failed for", url, resp.status);
          }
        } catch (err) {
          console.error("Precache fetch error for", url, err);
        }
      }
    })(),
  );
});

cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// Runtime cache for built assets with CacheFirst and fallback
registerRoute(
  ({ url }) => url.pathname.startsWith("/assets/"),
  async (options) => {
    try {
      return await new CacheFirst({ cacheName: "assets-cache" }).handle(
        options,
      );
    } catch (err) {
      return new StaleWhileRevalidate({ cacheName: "assets-cache" }).handle(
        options,
      );
    }
  },
);
