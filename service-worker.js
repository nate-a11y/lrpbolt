import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();
self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Avoid caching login page so users always see fresh auth UI
registerRoute(
  ({ url }) => url.pathname === '/login',
  new NetworkOnly(),
);

// Runtime caching for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api'),
  new StaleWhileRevalidate(),
);
