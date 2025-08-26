import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

self.skipWaiting();
clientsClaim();

// Injected at build: do not hardcode hashed asset names
precacheAndRoute(self.__WB_MANIFEST || []);

// Bypass SW for Google/Firestore/Analytics
const isThirdParty = (url) =>
  url.origin.includes('googleapis.com') ||
  url.origin.includes('google-analytics.com') ||
  url.origin.includes('gstatic.com') ||
  url.origin.includes('firebaseinstallations.googleapis.com');

registerRoute(({ url }) => isThirdParty(url), new NetworkOnly(), 'GET');
registerRoute(({ url }) => isThirdParty(url), new NetworkOnly(), 'POST');

// Same-origin assets (JS/CSS) → stale-while-revalidate
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['script', 'style', 'worker'].includes(request.destination),
  new StaleWhileRevalidate()
);
