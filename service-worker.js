import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { clientsClaim, cacheNames } from "workbox-core";
import { logError } from "./src/utils/errorUtils.js";

// Normalize and dedupe entries injected by Workbox. Without this, assets such
// as `manifest.webmanifest` may appear twice (with and without a revision query
// string) which triggers the
// `add-to-cache-list-conflicting-entries` error.
function normalizeAndDedupe(entries = []) {
  const seen = new Set();
  return entries.reduce((acc, entry) => {
    const url = new URL(entry.url, self.location);
    // Strip any query params like ?__WB_REVISION__ that make the same asset
    // appear twice in the precache manifest.
    url.search = "";
    const key = url.href;
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push({ ...entry, url: key });
    return acc;
  }, []);
}

const manifest = normalizeAndDedupe(self.__WB_MANIFEST);
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
            logError(resp.status, `Precache failed for ${url}`);
          }
        } catch (err) {
          logError(err, `Precache fetch error for ${url}`);
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
