// /src/utils/timeUtils.js
// Bulletproof Firestore Timestamp + date helpers (no runtime throws)

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

export const isFsTimestamp = (v) =>
  !!v && (typeof v.toDate === "function" || (typeof v.seconds === "number" && typeof v.nanoseconds === "number"));

export function toDate(v) {
  try {
    if (!v) return null;
    if (isFsTimestamp(v)) return typeof v.toDate === "function" ? v.toDate() : new Date(v.seconds * 1000);
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (v && typeof v.isValid === "function" && v.isValid()) return v.toDate();
    return null;
  } catch {
    return null;
  }
}

export function fmtDateTime(v, tz, fmt = "MMM D, YYYY h:mm A") {
  const d = toDate(v);
  if (!d) return "";
  return tz ? dayjs(d).tz(tz).format(fmt) : dayjs(d).format(fmt);
}

export function minutesBetween(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s) return null;
  const stop = e ?? new Date();
  const mins = Math.max(0, Math.round((stop.getTime() - s.getTime()) / 60000));
  return isFinite(mins) ? mins : null;
}

export function minutesToHMM(mins) {
  if (mins == null || !isFinite(mins)) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function minutesToHoursDecimal(mins, digits = 2) {
  if (mins == null || !isFinite(mins)) return "";
  return (mins / 60).toFixed(digits);
}

// Safe access helpers
export const safeStr = (v) => (v == null ? "" : String(v));
export const safeNum = (v, def = 0) => (typeof v === "number" && isFinite(v) ? v : def);

