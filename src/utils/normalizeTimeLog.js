/* Proprietary and confidential. See LICENSE. */
import { isNil, diffMinutes } from "./timeUtilsSafe";

const first = (o, keys) => {
  for (const k of keys) {
    if (o && o[k] !== undefined) return o[k];
  }
  return null;
};

const deriveMode = (rideId, explicit) => {
  const m = (explicit ?? "").toString().toUpperCase();
  if (m) return m;
  const id = (rideId ?? "").toString().toUpperCase();
  if (id === "N/A") return "N/A";
  if (id === "MULTI") return "MULTI";
  return id ? "RIDE" : "N/A";
};

const deriveStatus = (endTime, explicit) => {
  if (explicit) return explicit;
  return isNil(endTime) ? "Open" : "Closed";
};

/** Normalize one document from the timeLogs collection. */
export const normalizeTimeLog = (docId, d = {}) => {
  const driver = first(d, ["driverEmail", "driver", "userEmail", "user"]);
  const rideId = first(d, ["rideId", "RideID", "tripId", "TripID"]);
  const startTime = first(d, ["startTime", "start", "clockIn", "startedAt"]);
  const endTime = first(d, ["endTime", "end", "clockOut", "endedAt"]);
  const createdAt = first(d, ["createdAt", "loggedAt", "startTime"]);
  const mode = deriveMode(rideId, d?.mode);
  const status = deriveStatus(endTime, d?.status);

  // Duration: prefer stored number, else compute from timestamps.
  let durationMin = null;
  const stored = first(d, ["duration", "durationMin"]);
  if (!isNil(stored)) {
    const n = Number(stored);
    durationMin = Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  } else {
    durationMin = diffMinutes(startTime, endTime);
  }

  const trips = isNil(d?.trips) ? null : Number(d.trips);
  const passengers = isNil(d?.passengers) ? null : Number(d.passengers);

  return {
    id: docId,
    driverDisplay: driver || "—",
    rideId: rideId ?? null,
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

/** Normalize one document from the shootoutStats collection. */
export const normalizeShootout = (docId, d = {}) => {
  const driver = first(d, ["driverEmail", "driver", "userEmail", "user"]);
  const startTime = first(d, ["startTime", "startedAt"]);
  const endTime = first(d, ["endTime", "endedAt"]);
  const createdAt = first(d, ["createdAt", "loggedAt", "startTime"]);

  let durationMin = null;
  const stored = first(d, ["duration", "durationMin"]);
  if (!isNil(stored)) {
    const n = Number(stored);
    durationMin = Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
  } else {
    durationMin = diffMinutes(startTime, endTime);
  }

  return {
    id: docId,
    driverDisplay: driver || "—",
    trips: isNil(d?.trips) ? null : Number(d.trips),
    passengers: isNil(d?.passengers) ? null : Number(d.passengers),
    durationMin,
    status: d?.status || (isNil(endTime) ? "Open" : "Closed"),
    startTime,
    endTime,
    createdAt,
  };
};
