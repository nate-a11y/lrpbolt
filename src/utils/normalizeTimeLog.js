/* Proprietary and confidential. See LICENSE. */
import { isNil, diffMinutes } from "./timeUtilsSafe";

const first = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined) return v;
  }
  return null;
};

const deriveMode = (rawRideId, rawMode) => {
  const id = (rawRideId ?? "").toString().toUpperCase();
  const mode = (rawMode ?? "").toString().toUpperCase();
  if (mode) return mode;                 // respect explicit mode
  if (id === "N/A") return "N/A";
  if (id === "MULTI") return "MULTI";
  return "RIDE";
};

const deriveStatus = (endTime, explicit) => {
  if (explicit) return explicit;
  return isNil(endTime) ? "Open" : "Closed";
};

/** Normalize one Firestore time log doc into a flat row for the grid. */
export const normalizeTimeLog = (docId, d = {}) => {
  const driverEmail = first(d, ["driverEmail", "driver", "userEmail", "user"]) ?? null;
  const rideId      = first(d, ["rideId", "RideID", "tripId", "TripID"]) ?? null;
  const startTime   = first(d, ["startTime", "start", "clockIn", "startedAt"]) ?? null;
  const endTime     = first(d, ["endTime", "end", "clockOut", "endedAt"]) ?? null;
  const createdAt   = first(d, ["createdAt", "loggedAt", "startTime"]) ?? null;
  const mode        = deriveMode(rideId, d?.mode);
  const status      = deriveStatus(endTime, d?.status);

  // Prefer stored duration (number). Otherwise compute from start/end.
  let durationMin = null;
  const storedDuration = first(d, ["duration", "durationMin"]);
  if (!isNil(storedDuration)) {
    const n = Number(storedDuration);
    durationMin = Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  } else {
    durationMin = diffMinutes(startTime, endTime);
  }

  const trips      = isNil(d?.trips) ? null : Number(d.trips);
  const passengers = isNil(d?.passengers) ? null : Number(d.passengers);

  return {
    id: docId,
    driverDisplay: driverEmail || "—",
    rideId,
    mode,
    startTime,
    endTime,
    durationMin,
    status,
    trips,
    passengers,
    createdAt,
  };
};
