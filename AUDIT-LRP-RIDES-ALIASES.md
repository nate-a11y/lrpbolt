# Audit — Ride Aliases Restore

- Restored legacy aliases in `normalizeRide` so historic documents map to canonical keys:
  - `tripId` ← `tripId` | `tripID` | `rideId` | `trip` | `ticketId`
  - `pickupTime` ← `pickupTime` | `pickupAt` | `startAt` | `pickup`
- Verified RideQueueGrid, LiveRidesGrid, and ClaimedRidesGrid read canonical `tripId`, `pickupTime`, `rideType`, and `vehicle` columns.
- Edit dialog seeds form state from canonical keys with sensible defaults (e.g., `rideDuration` default `0`).
