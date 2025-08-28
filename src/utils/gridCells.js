import { dayjs } from "@/utils/time";

/** Returns the first non-empty value from a list */
export const coalesce = (...vals) => {
  for (const v of vals) {
    if (v === 0) return 0;
    if (
      v !== undefined &&
      v !== null &&
      !(typeof v === "string" && v.trim() === "")
    ) {
      return v;
    }
  }
  return null; // lets DataGrid decide to show the dash
};

/** Try common synonyms from different collections/snapshots */
const FIELD_SYNONYMS = {
  pickupTime: ["pickupTime", "startTime", "start", "pickup_at", "startAt"],
  endTime: ["endTime", "end", "end_at", "endAt"],
  createdAt: ["createdAt", "loggedAt", "created", "created_at", "logged_at"],
  vehicle: ["vehicle", "vehicleName", "vehicle_label"],
  rideType: ["rideType", "type", "ride_type"],
  rideDuration: ["rideDuration", "duration", "minutes"],
  rideNotes: ["rideNotes", "notes", "comment"],
  rideId: ["rideId", "rideID", "tripId", "trip_id", "id"],
  driver: ["driver", "driverName", "driverId", "driver_email", "driverEmail"],
};

/** Get a value from a row using synonyms (returns null if nothing real) */
export const getField = (row, logicalKeyOrExact) => {
  const keys = FIELD_SYNONYMS[logicalKeyOrExact] || [logicalKeyOrExact];
  for (const k of keys) {
    const v = row?.[k];
    if (v === 0) return 0;
    if (
      v !== undefined &&
      v !== null &&
      !(typeof v === "string" && v.trim() === "")
    ) {
      return v;
    }
  }
  return null;
};

export const fmtDateTime = (ts) =>
  ts ? dayjs(ts).format("MM/DD/YYYY hh:mm A") : null;

export const fmtMinutes = (mins) => {
  if (mins === null || mins === undefined || Number.isNaN(Number(mins)))
    return null;
  const m = Math.max(0, Number(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
};

/** Never throw; always return a string or null */
export const asText = (v) => {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
};
