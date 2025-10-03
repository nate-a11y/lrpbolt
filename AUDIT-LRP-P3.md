# LRP Driver Portal — Phase 3 FCM/Service Worker Audit

## Summary of Changes
- Service workers wrap install, activate, push, and notificationclick handlers in `event.waitUntil`, keeping the worker alive for async work.
- `notificationclick` now honors the `clockout` action: attempts the optional POST, then focuses/opens `/timeclock` even if the app was closed.
- FCM initialization uses `initMessagingAndToken`, which depends on `VITE_FIREBASE_VAPID_KEY` and logs outcomes through `AppError` + `logError`.
- Icons and badges for notifications consistently reference `/icons/icon-192.png` (192×192).

## Verification Checklist
- Close the app, deliver an FCM payload with `action=clockout`. Expect the service worker to attempt the POST, notify clients, and open `/timeclock`.
- On first run with a valid `VITE_FIREBASE_VAPID_KEY`, the bootstrap registers the service worker and logs the token acquisition attempt.
