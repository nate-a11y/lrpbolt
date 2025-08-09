import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";
import { clientsClaim } from "workbox-core";

self.skipWaiting();
clientsClaim();

const seen = new Set();
const normalized = [];
for (const e of self.__WB_MANIFEST || []) {
  const url = (typeof e === "string" ? e : e.url).split("?")[0];
  if (!seen.has(url)) {
    seen.add(url);
    normalized.push(
      typeof e === "string" ? { url, revision: null } : { ...e, url },
    );
  }
}

cleanupOutdatedCaches();
precacheAndRoute(normalized);

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin && request.destination !== "document",
  new StaleWhileRevalidate(),
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await Promise.all(
          normalized.map(async ({ url }) => {
            try {
              const r = await fetch(url, { cache: "no-store" });
              if (!r.ok) console.error("[SW] Precache failed:", url, r.status);
            } catch (err) {
              console.error(
                "[SW] Precache fetch error:",
                url,
                err && err.message,
              );
            }
          }),
        );
      } catch (e) {
        console.error("[SW] Install error:", e && e.message);
      }
    })(),
  );
});
