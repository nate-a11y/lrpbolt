# Hotfix Audit Log

## Ride creation timezone guard
- **Files:** `src/components/RideEntryForm.jsx`
- **Summary:** Row payload builder now accepts dayjs/Date/Timestamp inputs, converts to UTC without `.tz(..., true)`, and ensures Firestore writes use the correct instant while keeping display conversions local.
- **Verification:** Create a ride at 8:00 AM local and confirm Firestore stores the matching UTC Timestamp; ensure UI preview still shows local time.

## DataGrid density persistence
- **Files:** `src/components/datagrid/LrpDataGridPro.jsx`
- **Summary:** Grid state persistence stores density as a plain string for back-compat, allowing toolbar density selector to work again and keeping quick filter debounce at 300 ms per spec.
- **Verification:** Toggle density modes, reload the page, and confirm the selected density sticks and remains editable via the toolbar.

## Service worker clock-out authentication + result surfacing
- **Files:** `public/firebase-messaging-sw.js`, `src/pwa/swMessages.js`, `src/components/ClockOutConfirm.jsx`
- **Summary:** Clock-out fetches now include cookies, validate `response.ok`, and broadcast success/failure events to the app; UI listeners close confirmations, show snackbars, and open `/timeclock` on failure.
- **Verification:** Trigger background clock-out with valid cookies (notification closes, success snackbar). Repeat with invalid session/offline to confirm `/timeclock` opens and failure snackbar appears.

## Time log OR subscription + doc id usage
- **Files:** `src/services/fs/index.js`
- **Summary:** Time log subscription fans out across driverId/userId/driverEmail/userEmail filters, dedupes by doc id, and always emits `row.id` as the Firestore document id while retaining legacy ids in `logicalId`/`originalId`.
- **Verification:** Filter time logs for a driver whose historical entries stored email/display name; verify they appear and edits resolve by document id.

## Agent guidance updates
- **Files:** `src/agents/agents.json`
- **Summary:** Added repo-doctor and UI polish rules covering timezone storage, grid density persistence, service worker auth checks, time log OR filtering, and doc-id row emission.
- **Verification:** N/A (documentation update).
