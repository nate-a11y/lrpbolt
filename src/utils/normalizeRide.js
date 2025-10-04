/**
 * Grid-only normalizer for ride rows.
 * - Resolves legacy aliases (tripID/rideId/trip, pickupAt/pickup)
 * - Converts Firestore Timestamp -> Date
 * - Returns primitives so the grid never renders [object Object]
 * - Leaves raw document on _raw (modal uses its own path; do not import this there)
 */

function toDate(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  } catch (error) {
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.warn("[normalizeRide] toDate failed", error);
    }
  }
  if (v instanceof Date) return isNaN(v) ? null : v;
  const n = typeof v === "number" ? v : Date.parse(v);
  const d = new Date(n);
  return isNaN(d.getTime()) ? null : d;
}

function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function normalizeRide(docOrData) {
  const isSnap = !!docOrData && typeof docOrData.data === "function";
  const data = isSnap ? docOrData.data() || {} : docOrData || {};
  const id = isSnap ? docOrData.id || data.id : data.id || null;

  const tripId = data.tripId ?? data.tripID ?? data.rideId ?? data.trip ?? null;

  const pickupTimeRaw = data.pickupTime ?? data.pickupAt ?? data.pickup ?? null;

  const createdAtRaw = data.createdAt ?? null;
  const claimedAtRaw = data.claimedAt ?? data.ClaimedAt ?? null;

  return {
    id: id || null,
    tripId: str(tripId),
    pickupTime: toDate(pickupTimeRaw),
    rideDuration:
      typeof data.rideDuration === "number" ? data.rideDuration : null,
    rideType: str(data.rideType),
    vehicle: str(data.vehicle),
    rideNotes: str(data.rideNotes),
    status: str(data.status) || "queued",
    claimedBy: str(data.claimedBy ?? data.ClaimedBy),
    claimedAt: toDate(claimedAtRaw),
    createdAt: toDate(createdAtRaw),
    createdBy: str(data.createdBy),
    updatedAt: toDate(data.updatedAt),
    lastModifiedBy: str(data.lastModifiedBy),
    _raw: data,
  };
}

export function normalizeRideArray(items) {
  return (items || []).map(normalizeRide);
}
