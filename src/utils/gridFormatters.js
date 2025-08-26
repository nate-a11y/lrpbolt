/* Proprietary and confidential. See LICENSE. */
import { Timestamp as FBTimestamp } from "firebase/firestore";

import { TIMEZONE } from "../constants";

import dayjs from "./dates";

/** Null-safe param accessors */
export const getParams = (p) => (p && typeof p === "object" ? p : null);
export const getRow = (p) => (getParams(p) && getParams(p).row) ? getParams(p).row : null;
export const getValue = (p) => (getParams(p) && "value" in p) ? p.value : null;

/** Any -> Date or null (handles Firestore Timestamp, {seconds,nanoseconds}, Date, ISO, ms-epoch) */
export const toDateAny = (v) => {
  try {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d) ? null : d;
    }
    if (typeof v === "number") {
      const d = new Date(v);
      return isNaN(d) ? null : d;
    }
    if (typeof v === "object") {
      if (typeof v.toDate === "function") return v.toDate();
      if ("seconds" in v && "nanoseconds" in v) {
        return new FBTimestamp(v.seconds, v.nanoseconds).toDate();
      }
    }
  } catch { /* no-op */ }
  return null;
};

export const toDj = (v) => {
  const d = toDateAny(v);
  if (!d) return null;
  const dj = dayjs(d);
  return dj.isValid() ? dj : null;
};

export const fmtDate = (v) => {
  const dj = toDj(v);
  return dj ? dj.tz(TIMEZONE).format("MM/DD/YYYY") : "N/A";
};

export const fmtTime = (v) => {
  const dj = toDj(v);
  return dj ? dj.tz(TIMEZONE).format("h:mm A") : "N/A";
};

export const coerceMinutes = (v) => {
  if (Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const minutesToHHMM = (mins) => {
  const m = coerceMinutes(mins);
  if (m == null) return "N/A";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/** Safe wrappers so MUI null-calls don't crash */
export const safeVG = (fn) => (params) => {
  try { return fn(getParams(params)); } catch { return null; }
};
export const safeVF = (fn) => (params) => {
  try { return fn(getValue(params), getParams(params)); } catch { return "N/A"; }
};
export const safeRC = (fn) => (params) => {
  try { return fn(getValue(params), getParams(params)); } catch { return null; }
};

/** Common getters from canonical Firestore fields */
export const getPickupTime = safeVG((p) => {
  const row = getRow(p);
  return row ? row.pickupTime ?? row.PickupTime ?? null : null;
});
export const getRideDuration = safeVG((p) => {
  const row = getRow(p);
  const dur = row ? row.rideDuration ?? row.RideDuration : null;
  return row ? coerceMinutes(dur) : null;
});
