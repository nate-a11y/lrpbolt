// /src/services/normalizers.js
// Convert Firestore docs into a single, consistent shape the grids expect.

import { minutesBetween, toDate, safeStr, safeNum } from "../utils/timeUtils";

export function normalizeTimeLog(id, d) {
  const start = toDate(d.startTime);
  const end = toDate(d.endTime);
  return {
    id,
    driver: safeStr(d.driverId || d.driver || d.driverName || d.driverEmail || "Unknown"),
    driverEmail: safeStr(d.driverEmail),
    rideId: safeStr(d.rideId || d.tripId || d.ride || d.id || d.tripID),
    start,
    end,
    created: toDate(d.loggedAt || d.createdAt),
    updated: toDate(d.updatedAt),
    durationMins:
      typeof d.durationMins === "number"
        ? d.durationMins
        : typeof d.rideDuration === "number"
        ? Math.max(0, Math.round(d.rideDuration))
        : minutesBetween(start, end),
    vehicle: safeStr(d.vehicle),
    mode: safeStr(d.mode),
    trips: d.trips != null ? safeNum(d.trips) : null,
    passengers: d.passengers != null ? safeNum(d.passengers) : null,
  };
}

export function normalizeShootout(id, d) {
  const start = toDate(d.startTime);
  const end = toDate(d.endTime);
  return {
    id,
    driver: safeStr(d.driver || d.driverId || d.driverName || d.driverEmail || "Unknown"),
    driverEmail: safeStr(d.driverEmail),
    start,
    end,
    created: toDate(d.createdAt),
    vehicle: safeStr(d.vehicle),
    trips: d.trips != null ? safeNum(d.trips) : null,
    passengers: d.passengers != null ? safeNum(d.passengers) : null,
    durationMins: minutesBetween(start, end),
  };
}

export function normalizeRide(id, d) {
  const rideId = safeStr(d.rideId || d.tripId || id);
  const pickup = toDate(d.pickupTime);
  const minutes = typeof d.rideDuration === "number" ? Math.max(0, Math.round(d.rideDuration)) : null;
  return {
    id: rideId || id,
    rideId,
    status: safeStr(d.status),
    pickupTime: pickup,
    durationMins: minutes,
    vehicle: safeStr(d.vehicle),
    rideType: safeStr(d.rideType),
    notes: safeStr(d.rideNotes),
    claimedBy: d.claimedBy ?? null,
    claimedAt: toDate(d.claimedAt),
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  };
}

