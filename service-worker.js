import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { clientsClaim } from "workbox-core";

// Manifest injected at build time
// Deduplicate entries, keeping the first occurrence of each URL (ignore query params)
const seen = new Set();
const manifest = self.__WB_MANIFEST.filter(({ url }) => {
  const cleanUrl = url.split("?")[0];
  if (seen.has(cleanUrl)) return false;
  seen.add(cleanUrl);
  return true;
});

precacheAndRoute(manifest);

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
