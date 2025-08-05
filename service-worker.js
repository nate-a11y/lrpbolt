import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { clientsClaim } from "workbox-core";

// Manifest injected at build time
const manifest = self.__WB_MANIFEST;

// Precache files injected at build time
precacheAndRoute([
  ...manifest,
  { url: "manifest.webmanifest", revision: null },
]);

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

// Runtime cache for built assets
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

// Cache manifest.webmanifest and serve cached version if network fails
registerRoute(
  ({ url }) => url.pathname.endsWith("manifest.webmanifest"),
  new StaleWhileRevalidate({
    cacheName: "manifest-cache",
    plugins: [
      {
        handlerDidError: async () => {
          const cache = await caches.open("manifest-cache");
          const cached = await cache.match("manifest.webmanifest");
          return cached || Response.error();
        },
      },
    ],
  }),
);
