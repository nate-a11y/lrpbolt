# LRP Driver Portal — Phase 3 FCM/Service Worker Audit

## Summary of Changes
- Wrapped all async service worker handlers with `event.waitUntil` and unified notification assets (192×192 icon/badge). Clock-out actions now POST to `/api/clockout`, broadcast state updates, and open `/timeclock` after the attempt.
- Hardened foreground bootstrap: the app registers the service worker on load, initializes Firebase Messaging, validates the VAPID key, and requests a token via the new `getFcmTokenSafe` helper with structured logging.
- Added guarded push token utility that enforces presence of the VAPID key, prompts for permission, and logs failures without silent catches. Updated consumers to use the new API.
- Documented agent rule for the repo doctor to keep service workers resilient.

## Verification Checklist
- Close app, deliver an FCM payload with `action=clockout`. Expect the service worker to attempt the POST, notify clients, and focus/open `/timeclock` even if the app was closed.
- On first run with a valid `VITE_FIREBASE_VAPID_KEY`, the app bootstrap registers the service worker and logs successful FCM token acquisition.
