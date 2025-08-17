/* Proprietary and confidential. See LICENSE. */
import { TIMEZONE } from "../constants";

import dayjs from "./dates";

/** Null-safe param accessors */
export const getParams = (p) => (p && typeof p === "object" ? p : null);
export const getRow = (p) => (getParams(p) && getParams(p).row) ? getParams(p).row : null;
export const getValue = (p) => (getParams(p) && "value" in p) ? p.value : null;

/** Timestamp | Date | ISO -> dayjs or null */
export const toDj = (v) => {
  try {
    const d = v?.toDate ? v.toDate() : v;
    const dj = dayjs(d);
    return dj.isValid() ? dj : null;
  } catch {
    return null;
  }
};

export const fmtDate = (v) => {
  const dj = toDj(v);
  return dj ? dj.tz(TIMEZONE).format("MM/DD/YYYY") : "N/A";
};

export const fmtTime = (v) => {
  const dj = toDj(v);
  return dj ? dj.tz(TIMEZONE).format("h:mm A") : "N/A";
};

export const minutesToHHMM = (mins) => {
  if (!Number.isFinite(mins)) return "N/A";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
};

/** Safe wrappers so MUI null-calls don't crash */
export const safeVG = (fn) => (params) => {
  try { return fn(getParams(params)) } catch { return null; }
};

export const safeVF = (fn) => (params) => {
  try { return fn(getValue(params), getParams(params)) } catch { return "N/A"; }
};

export const safeRC = (fn) => (params) => {
  try { return fn(getValue(params), getParams(params)) } catch { return null; }
};

/** Common getters */
export const getPickupTime = safeVG((p) => {
  const row = getRow(p);
  return row ? (row.pickupTime ?? null) : null;
});

export const getRideDuration = safeVG((p) => {
  const row = getRow(p);
  return row && Number.isFinite(row.rideDuration) ? row.rideDuration : null;
});
