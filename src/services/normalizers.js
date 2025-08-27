/* Proprietary and confidential. See LICENSE. */
import { Timestamp, doc, getDoc } from "firebase/firestore";

import { nullifyMissing } from "../utils/formatters";

// ---------- Helpers ----------
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
  // tolerate export shapes {seconds,nanoseconds}
  if (typeof v === "object" && Number.isFinite(v.seconds)) {
    return Timestamp.fromMillis(v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6));
  }
  return null;
}
function coerceNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === "object" && typeof v.minutes === "number") return v.minutes;
  return null;
}
function coerceBool(v) {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true","yes","y","1"].includes(s)) return true;
    if (["false","no","n","0"].includes(s)) return false;
  }
  if (typeof v === "number") return v !== 0;
  return null;
}
const id = (v) => (v === undefined ? null : v);

function minutesBetween(tsStart, tsEnd) {
  const s = coerceTimestamp(tsStart);
  const e = coerceTimestamp(tsEnd);
  if (!s || !e) return null;
  const mins = Math.round((e.toDate().getTime() - s.toDate().getTime()) / (60 * 1000));
  return Number.isFinite(mins) && mins >= 0 ? mins : null;
}

// ---------- Rides ----------
const RIDE_ALIASES = { ClaimedBy: "claimedBy", ClaimedAt: "claimedAt", pickup: "pickupTime" };
const RIDE_COERCE = {
  tripId: id,
  pickupTime: coerceTimestamp, // <- /rides "Pickup" will render from this
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

// ---------- Time Logs ----------
const TIMELOG_ALIASES = { driverName: "driver" };
const TIMELOG_COERCE = {
  driverEmail: id,
  driver: id,
  rideId: id,
  startTime: coerceTimestamp,
  endTime: coerceTimestamp,
  duration: coerceNumber,          // minutes (may be null; we compute below)
  loggedAt: coerceTimestamp,
  note: id,
};

// ---------- Shootout ----------
const SHOOTOUT_COERCE = {
  driverEmail: id,
  vehicle: id,
  startTime: coerceTimestamp,
  endTime: coerceTimestamp,
  trips: coerceNumber,
  passengers: coerceNumber,
  createdAt: coerceTimestamp,
};

// ---------- Tickets ----------
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

/** Core normalize */
export function normalizeRowFor(collectionKey, raw = {}) {
  const data = nullifyMissing(raw);
  let row;
  switch (collectionKey) {
    case "liveRides":
    case "rideQueue":
    case "claimedRides":
      row = applyCoercion(applyAliases(data, RIDE_ALIASES), RIDE_COERCE);
      break;
    case "timeLogs":
      row = applyCoercion(applyAliases(data, TIMELOG_ALIASES), TIMELOG_COERCE);
      // dynamic duration fallback
      if (row.duration == null) row.duration = minutesBetween(row.startTime, row.endTime);
      break;
    case "shootoutStats":
      row = applyCoercion(data, SHOOTOUT_COERCE);
      // add computed duration minutes for the grid/export
      row.duration = minutesBetween(row.startTime, row.endTime);
      break;
    case "tickets":
      row = applyCoercion(applyAliases(data, TICKET_ALIASES), TICKET_COERCE);
      break;
    default:
      row = data;
  }
  return row;
}

export function mapSnapshotToRows(collectionKey, snapshot) {
  return snapshot.docs.map((d) => {
    const data = d.data() || {};
    return { id: d.id, ...normalizeRowFor(collectionKey, data) };
  });
}

/** --- User name enrichment (driverEmail -> driver via userAccess) --- */
let _nameCache = new Map();
let _dbRef = null;
export function bindFirestore(db) { _dbRef = db; }

/** Given rows that contain driverEmail, ensure row.driver is populated from userAccess */
export async function enrichDriverNames(rows) {
  if (!_dbRef || !rows?.length) return rows;
  const needs = rows
    .map((r) => (r?.driverEmail || "").toLowerCase())
    .filter((e) => e && !_nameCache.has(e));
  const unique = Array.from(new Set(needs));
  await Promise.all(
    unique.map(async (email) => {
      try {
        const ref = doc(_dbRef, "userAccess", email);
        const snap = await getDoc(ref);
        const name = snap.exists() ? (snap.data()?.name || snap.data()?.displayName || "") : "";
        _nameCache.set(email, name);
      } catch {
        _nameCache.set(email, "");
      }
    })
  );
  return rows.map((r) => {
    const email = (r?.driverEmail || "").toLowerCase();
    const driver = r?.driver || _nameCache.get(email) || "";
    return { ...r, driver };
  });
}
