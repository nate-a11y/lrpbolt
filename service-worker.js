import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { clientsClaim } from "workbox-core";

// Manifest injected at build time
// Remove duplicate entries (strip query params before comparison)
const manifest = self.__WB_MANIFEST.filter((entry, index, arr) => {
  const url = entry.url.split("?")[0];
  return index === arr.findIndex((e) => e.url.split("?")[0] === url);
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
