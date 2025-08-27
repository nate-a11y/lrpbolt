// /src/services/normalizers.js
// Convert Firestore docs into a single, consistent shape the grids expect.

import { minutesBetween, safeString, safeNumber } from "../utils/timeUtils.js";
import { toDayjs } from "../utils/datetime.js";

export function normalizeTimeLog(id, d) {
  const start = toDayjs(d.startTime)?.toDate();
  const end = toDayjs(d.endTime)?.toDate();
  return {
    id,
    driver: safeString(d.driverId || d.driver || d.driverName || d.driverEmail || "Unknown"),
    driverEmail: safeString(d.driverEmail),
    rideId: safeString(d.rideId || d.tripId || d.tripID || id),
    start,
    end,
    created: toDayjs(d.loggedAt || d.createdAt)?.toDate(),
    updated: toDayjs(d.updatedAt)?.toDate(),
    durationMins:
      typeof d.durationMins === "number"
        ? d.durationMins
        : typeof d.rideDuration === "number"
        ? Math.max(0, Math.round(d.rideDuration))
        : minutesBetween(start, end),
    vehicle: safeString(d.vehicle),
    mode: safeString(d.mode),
    trips: d.trips != null ? safeNumber(d.trips) : null,
    passengers: d.passengers != null ? safeNumber(d.passengers) : null,
  };
}

export function normalizeShootout(id, d) {
  const start = toDayjs(d.startTime)?.toDate();
  const end = toDayjs(d.endTime)?.toDate();
  return {
    id,
    driver: safeString(d.driver || d.driverId || d.driverName || d.driverEmail || "Unknown"),
    driverEmail: safeString(d.driverEmail),
    start,
    end,
    created: toDayjs(d.createdAt)?.toDate(),
    vehicle: safeString(d.vehicle),
    trips: d.trips != null ? safeNumber(d.trips) : null,
    passengers: d.passengers != null ? safeNumber(d.passengers) : null,
    durationMins: minutesBetween(start, end),
  };
}

export function normalizeRide(id, d) {
  const rideId = safeString(d.rideId || d.tripId || id);
  const pickup = toDayjs(d.pickupTime)?.toDate();
  const minutes = typeof d.rideDuration === "number" ? Math.max(0, Math.round(d.rideDuration)) : null;
  return {
    id: rideId || id,
    rideId,
    status: safeString(d.status),
    pickupTime: pickup,
    durationMins: minutes,
    vehicle: safeString(d.vehicle),
    rideType: safeString(d.rideType),
    notes: safeString(d.rideNotes),
    claimedBy: d.claimedBy ?? null,
    claimedAt: toDayjs(d.claimedAt)?.toDate(),
    createdAt: toDayjs(d.createdAt)?.toDate(),
    updatedAt: toDayjs(d.updatedAt)?.toDate(),
  };
}
