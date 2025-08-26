/* Proprietary and confidential. See LICENSE. */
/**
 * Workbox injectManifest SW with safe defaults.
 * - Precaches ONLY files Vite built (via __WB_MANIFEST).
 * - Cleans old caches to avoid 404s on hashed bundles.
 * - NO runtime route hijacking beyond static assets.
 * - Integrates Firebase Messaging background handler.
 */
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

// ---- SW lifecycle: update promptly but safely
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// ---- Precache only what the build says exists
// __WB_MANIFEST is injected at build time by vite-plugin-pwa (injectManifest)
precacheAndRoute(self.__WB_MANIFEST || [], {
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
});

// ---- Light runtime cache for same-origin scripts/styles/images
registerRoute(
  ({ request }) => ['script', 'style', 'image'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'lrp-assets' })
);

/**
 * ---- Firebase Cloud Messaging background notifications ----
 * We use compat builds via importScripts because SW cannot use ESM modules.
 * IMPORTANT: Use the SAME Firebase config as in app code.
 * Inject these values at build time using Vite env variables.
 */
try {
  // Only load if config is provided at build time
  // (Define these in vite config: VITE_FB_API_KEY, etc.)
  // eslint-disable-next-line no-undef
  const FB_API_KEY = import.meta.env.VITE_FB_API_KEY;
  if (FB_API_KEY) {
    // eslint-disable-next-line no-undef
    importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
    // eslint-disable-next-line no-undef
    importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

    // eslint-disable-next-line no-undef
    firebase.initializeApp({
      apiKey: import.meta.env.VITE_FB_API_KEY,
      authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FB_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FB_APP_ID,
      measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID
    });

    // eslint-disable-next-line no-undef
    const messaging = firebase.messaging();

    // Background message handler
    // eslint-disable-next-line no-undef
    messaging.onBackgroundMessage((payload) => {
      const title = payload?.notification?.title || 'Notification';
      const body = payload?.notification?.body || '';
      const icon = payload?.notification?.icon || '/favicon.ico';
      self.registration.showNotification(title, { body, icon, data: payload?.data || {} });
    });
  }
} catch (e) {
  // Do not crash SW if FCM not configured
  // eslint-disable-next-line no-console
  console.warn('[SW] FCM init skipped or failed:', e);
}
