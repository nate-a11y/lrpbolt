/* Proprietary and confidential. See LICENSE. */
import { Timestamp } from "firebase/firestore";
import { nullifyMissing } from "../utils/formatters";

// ------------ helpers ------------
function coerceTimestamp(v) {
  if (!v) return null;
  if (v instanceof Timestamp) return v;
  if (typeof v?.toDate === "function") return v; // Firestore Timestamp-like
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (typeof v === "number") return Timestamp.fromMillis(v);
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Timestamp.fromMillis(n);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
  }
  return null;
}
function coerceNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function coerceBool(v) {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(s)) return true;
    if (["false", "no", "n", "0"].includes(s)) return false;
  }
  if (typeof v === "number") return v !== 0;
  return null;
}
const id = (v) => (v === undefined ? null : v);

// ------------ collection configs from rules ------------

// Rides (liveRides, rideQueue, claimedRides)
const RIDE_ALIASES = {
  // tolerate legacy casing
  ClaimedBy: "claimedBy",
  ClaimedAt: "claimedAt",
};
const RIDE_COERCE = {
  tripId: id,
  pickupTime: coerceTimestamp,
  rideDuration: coerceNumber,
  rideType: id,
  vehicle: id,
  rideNotes: id,
  claimedBy: id,
  claimedAt: coerceTimestamp,
  status: id,
  importedFromQueueAt: coerceTimestamp,
  createdAt: coerceTimestamp,
  createdBy: id,
  updatedAt: coerceTimestamp,
  lastModifiedBy: id,
};

// timeLogs
const TIMELOG_ALIASES = {};
const TIMELOG_COERCE = {
  driverEmail: id,
  driver: id,
  rideId: id,
  startTime: coerceTimestamp,
  endTime: coerceTimestamp,
  duration: coerceNumber,
  loggedAt: coerceTimestamp,
  note: id,
};

// shootoutStats
const SHOOTOUT_ALIASES = {};
const SHOOTOUT_COERCE = {
  driverEmail: id,
  vehicle: id,
  startTime: coerceTimestamp,
  endTime: coerceTimestamp,
  trips: coerceNumber,
  passengers: coerceNumber,
  createdAt: coerceTimestamp,
};

// tickets (alias passengercount -> passengers for UI consistency)
const TICKET_ALIASES = {
  passengercount: "passengers",
};
const TICKET_COERCE = {
  pickupTime: coerceTimestamp,
  passengers: coerceNumber,
  ticketId: id,
  passenger: id,
  pickup: id,
  dropoff: id,
  notes: id,
  scannedOutbound: coerceBool,
  scannedReturn: coerceBool,
  createdAt: coerceTimestamp,
  scannedOutboundAt: coerceTimestamp,
  scannedOutboundBy: id,
  scannedReturnAt: coerceTimestamp,
  scannedReturnBy: id,
};

// ------------ core normalize ------------
function applyAliases(data, aliasMap) {
  const out = {};
  for (const k of Object.keys(data)) {
    const v = data[k];
    const target = aliasMap[k] || k;
    // keep both if aliasing to a new key and original target already exists? prefer canonical
    if (out[target] === undefined) out[target] = v;
  }
  return out;
}
function applyCoercion(data, rules) {
  const out = { ...data };
  Object.keys(rules).forEach((field) => {
    out[field] = rules[field](out[field]);
  });
  // standardize undefined -> null on known fields
  Object.keys(rules).forEach((field) => {
    if (out[field] === undefined) out[field] = null;
  });
  return out;
}

/**
 * Normalize one Firestore doc for the given collection key.
 * Supported keys: "liveRides" | "rideQueue" | "claimedRides" | "timeLogs" | "shootoutStats" | "tickets"
 */
export function normalizeRowFor(collectionKey, raw = {}) {
  const data = nullifyMissing(raw);

  switch (collectionKey) {
    case "liveRides":
    case "rideQueue":
    case "claimedRides": {
      const withAliases = applyAliases(data, RIDE_ALIASES);
      return applyCoercion(withAliases, RIDE_COERCE);
    }
    case "timeLogs": {
      const withAliases = applyAliases(data, TIMELOG_ALIASES);
      return applyCoercion(withAliases, TIMELOG_COERCE);
    }
    case "shootoutStats": {
      const withAliases = applyAliases(data, SHOOTOUT_ALIASES);
      return applyCoercion(withAliases, SHOOTOUT_COERCE);
    }
    case "tickets": {
      const withAliases = applyAliases(data, TICKET_ALIASES);
      return applyCoercion(withAliases, TICKET_COERCE);
    }
    default:
      // Unknown: just nullifyMissing
      return data;
  }
}

/** Map snapshot -> normalized rows for a known collection key. */
export function mapSnapshotToRows(collectionKey, snapshot) {
  return snapshot.docs.map((d) => {
    const data = d.data() || {};
    return { id: d.id, ...normalizeRowFor(collectionKey, data) };
  });
}
