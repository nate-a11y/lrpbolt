/* Proprietary and confidential. See LICENSE. */
// src/utils/timeUtils.js
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = typeof window !== "undefined" ? dayjs.tz.guess() : "UTC";
const DEFAULT_FMT = "MMM D, YYYY h:mm A";

/** Firestore Timestamp shape guard */
export function isFsTimestamp(v) {
  return !!v && typeof v === "object" && typeof v.seconds === "number" && typeof v.nanoseconds === "number";
}

/** Convert Firestore Timestamp | Date | string | number to dayjs or null */
export function toDayjs(input) {
  if (!input) return null;
  try {
    if (isFsTimestamp(input)) {
      // Firestore TS -> milliseconds
      const ms = input.seconds * 1000 + Math.floor(input.nanoseconds / 1e6);
      const d = dayjs(ms);
      return d.isValid() ? d.tz(DEFAULT_TZ) : null;
    }
    if (input instanceof Date) {
      const d = dayjs(input);
      return d.isValid() ? d.tz(DEFAULT_TZ) : null;
    }
    if (typeof input === "number" || typeof input === "string") {
      const d = dayjs(input);
      return d.isValid() ? d.tz(DEFAULT_TZ) : null;
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/** Format TS to string or "N/A" */
export function formatDateTime(input, fmt = DEFAULT_FMT) {
  const d = toDayjs(input);
  return d ? d.format(fmt) : "N/A";
}

/** Safe number formatting with optional fallback */
export function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Safe string with fallback */
export function safeString(v, fallback = "N/A") {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s.length ? s : fallback;
}

/** Duration (minutes) from start/end Timestamps; never negative */
export function minutesBetween(startTs, endTs) {
  const start = toDayjs(startTs);
  const end = toDayjs(endTs);
  if (!start || !end) return null;
  const diff = end.diff(start, "minute");
  return diff >= 0 ? diff : null;
}

/** Human friendly minutes -> "3h 12m" */
export function fmtMinutesHuman(total) {
  if (total === null || total === undefined) return "N/A";
  const mins = Math.max(0, Math.floor(total));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
