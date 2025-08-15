/* Proprietary and confidential. See LICENSE. */
import { isNil, diffMinutes, firstKey } from "./timeUtilsSafe";

const deriveMode = (rideId, explicit) => {
  const m = (explicit ?? "").toString().toUpperCase();
  if (m) return m;
  const id = (rideId ?? "").toString().toUpperCase();
  if (id === "N/A") return "N/A";
  if (id === "MULTI") return "MULTI";
  return id ? "RIDE" : "N/A";
};

const deriveStatus = (endTime, explicit) => (explicit ? explicit : isNil(endTime) ? "Open" : "Closed");

export const normalizeTimeLog = (docId, d = {}) => {
  const driver     = firstKey(d, [
    "driverDisplay",
    "driverEmail",
    "driver",
    "userEmail",
    "user",
    "email",
    "driverName",
  ]);
  const rideId     = firstKey(d, ["rideId", "RideID", "tripId", "TripID"]);
  const startTime  = firstKey(d, ["startTime", "start", "clockIn", "startedAt"]);
  const endTime    = firstKey(d, ["endTime", "end", "clockOut", "endedAt"]);
  const createdAt  = firstKey(d, ["createdAt", "loggedAt", "startTime"]);
  const mode       = deriveMode(rideId, d?.mode);
  const status     = deriveStatus(endTime, d?.status);

  const storedDur  = firstKey(d, ["duration", "durationMin"]);
  const durationMin = !isNil(storedDur)
    ? (Number.isFinite(Number(storedDur)) ? Math.max(0, Math.round(Number(storedDur))) : null)
    : diffMinutes(startTime, endTime);

  return {
    id: docId,
    _raw: d,                      // keep raw for last-resort rendering
    driverDisplay: driver || "—",
    rideId: rideId ?? null,
    startTime, endTime, createdAt,
    durationMin,
    mode, status,
    trips: isNil(d?.trips) ? null : Number(d.trips),
    passengers: isNil(d?.passengers) ? null : Number(d.passengers),
  };
};

export const normalizeShootout = (docId, d = {}) => {
  const driver    = firstKey(d, [
    "driverDisplay",
    "driverEmail",
    "driver",
    "userEmail",
    "user",
    "email",
    "driverName",
  ]);
  const startTime = firstKey(d, ["startTime", "start", "clockIn", "startedAt"]);
  const endTime   = firstKey(d, ["endTime", "end", "clockOut", "endedAt"]);
  const createdAt = firstKey(d, ["createdAt", "loggedAt", "startTime"]);
  const storedDur = firstKey(d, ["duration", "durationMin"]);
  const durationMin = !isNil(storedDur)
    ? (Number.isFinite(Number(storedDur)) ? Math.max(0, Math.round(Number(storedDur))) : null)
    : diffMinutes(startTime, endTime);

  return {
    id: docId,
    _raw: d,
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
