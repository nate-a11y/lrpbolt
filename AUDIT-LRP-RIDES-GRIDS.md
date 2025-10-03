# Audit — Ride Grid Normalization

- Added `src/services/mappers/rides.js` to normalize ride docs (`id`, `tripId`, `pickupTime`, `rideType`, `vehicle`, `status`) while retaining raw fields.
- Updated ride fetchers/subscriptions to use `normalizeRideArray` so Firestore snapshots flow through the canonical mapper.
- Refreshed Live/Queue/Claimed grid columns to read canonical keys, format timestamps with dayjs, and drop blanket "N/A" fallbacks.
