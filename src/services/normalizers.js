/* Proprietary and confidential. See LICENSE. */
import { Timestamp } from "firebase/firestore";

import { nullifyMissing } from "../utils/formatters";

function coerceTimestamp(v) {
  if (!v) return null;
  if (v instanceof Timestamp) return v;
  if (typeof v?.toDate === "function") return v;
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
  if (v && typeof v === "object" && typeof v.minutes === "number") return v.minutes; // tolerate {minutes}
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

// Pull a nice string from claimedBy (string | {name,email} | null)
function coerceClaimedBy(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.name || v.email || null;
  return null;
}

// ---- Collection configs from your rules ----
const RIDE_ALIASES = { ClaimedBy: "claimedBy", ClaimedAt: "claimedAt" };
const RIDE_COERCE = {
  tripId: id,
  pickupTime: coerceTimestamp,
  rideDuration: coerceNumber,
  rideType: id,
  vehicle: id,
  rideNotes: id,
  claimedBy: coerceClaimedBy,
  claimedAt: coerceTimestamp,
  status: id,
  importedFromQueueAt: coerceTimestamp,
  createdAt: coerceTimestamp,
  createdBy: id,
  updatedAt: coerceTimestamp,
  lastModifiedBy: id,
};

const TIMELOG_ALIASES = { driverName: "driver" }; // tolerate old key
const TIMELOG_COERCE = {
  driverEmail: id,
  driver: id,
  rideId: id,
  startTime: coerceTimestamp,
  endTime: coerceTimestamp,
  duration: coerceNumber, // minutes
  loggedAt: coerceTimestamp,
  note: id,
};

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

const TICKET_ALIASES = { passengercount: "passengers" };
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

function applyAliases(data, aliasMap) {
  const out = {};
  for (const k of Object.keys(data)) {
    const target = aliasMap[k] || k;
    if (out[target] === undefined) out[target] = data[k];
  }
  return out;
}
function applyCoercion(data, rules) {
  const out = { ...data };
  Object.keys(rules).forEach((field) => { out[field] = rules[field](out[field]); });
  Object.keys(rules).forEach((field) => { if (out[field] === undefined) out[field] = null; });
  return out;
}

export function normalizeRowFor(collectionKey, raw = {}) {
  const data = nullifyMissing(raw);
  switch (collectionKey) {
    case "liveRides":
    case "rideQueue":
    case "claimedRides":
      return applyCoercion(applyAliases(data, RIDE_ALIASES), RIDE_COERCE);
    case "timeLogs":
      return applyCoercion(applyAliases(data, TIMELOG_ALIASES), TIMELOG_COERCE);
    case "shootoutStats":
      return applyCoercion(applyAliases(data, SHOOTOUT_ALIASES), SHOOTOUT_COERCE);
    case "tickets":
      return applyCoercion(applyAliases(data, TICKET_ALIASES), TICKET_COERCE);
    default:
      return data;
  }
}

export function mapSnapshotToRows(collectionKey, snapshot) {
  return snapshot.docs.map((d) => {
    const data = d.data() || {};
    return { id: d.id, ...normalizeRowFor(collectionKey, data) };
  });
}
