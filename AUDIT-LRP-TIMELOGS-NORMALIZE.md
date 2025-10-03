# Audit — TimeLogs Normalize Hotfix

## Files Updated
- `src/services/fs/index.js`
- `src/hooks/useActiveTimeSession.js`
- `src/components/TimeClock.jsx`
- `src/utils/time.js`
- `src/App.jsx`

## Canonical Fields
- `id` (Firestore `doc.id`)
- `startTs` / `endTs`
- `status` (`open`/`closed` inferred when absent)
- `driverKey`
- `driverName`
- `driverId`/`userId` retained for back-compat

## Legacy Mappings Covered
- `startTime | clockInAt | clockIn | start` → `startTs`
- `endTime | clockOutAt | clockOut | end` → `endTs`
- `driverId | userId | driverEmail | userEmail` → `driverKey`
- `displayName | driverName | name | driver` → `driverName`
- Preserved `logicalId` from legacy `id`

## Analytics Guard
- Added one-time global guard around analytics init in `src/App.jsx` to prevent duplicate GA sessions.

## Test Steps
1. **Clock In** – Start a session from TimeClock; Firestore doc includes `startTs`, `startTime`, `driverKey`, `status: "open"` with canonical values.
2. **Admin Time Log** – Admin grid rows display populated timestamps/driver data instead of `N/A` when available.
3. **Historical Sessions** – Legacy entries with `driverId`/`displayName` load via OR subscription and surface in grids/time clock.
4. **Reload Analytics** – Refresh App; observe a single GA init/post (no repeated analytics initialization).
