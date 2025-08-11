import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());

const seen = new Set();
const normalized = [];
for (const e of self.__WB_MANIFEST || []) {
  const url = (typeof e === "string" ? e : e.url).split("?")[0];
  if (!seen.has(url)) {
    seen.add(url);
    normalized.push(typeof e === "string" ? { url, revision: null } : { ...e, url });
  }
}

cleanupOutdatedCaches();
precacheAndRoute(normalized);

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin && request.destination !== "document",
  new StaleWhileRevalidate(),
);
