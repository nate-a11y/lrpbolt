# LRP Hotfix — Firebase singleton + FCM guards

- Created `src/services/firebaseApp.js` singleton.
- `firestoreCore.js` now uses the singleton app.
- `fcm.js` uses the singleton and guards SW + FCM boot.
- `useElapsedFromTs` is null-safe (logs once, no throw).
- `main.jsx` only calls `initMessagingAndToken` once.
