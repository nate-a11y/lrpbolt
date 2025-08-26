/* Proprietary and confidential. See LICENSE. */
import dayjs from "./dates";

// Normalize Firestore Timestamps, JS Dates, epoch seconds, or ISO strings -> Date | null
export const toJSDate = (raw) => {
  try {
    if (!raw) return null;
    if (raw instanceof Date) return isNaN(raw) ? null : raw;
    if (typeof raw === "number") {
      const ms = raw < 1e12 ? raw * 1000 : raw;
      const d = new Date(ms);
      return isNaN(d) ? null : d;
    }
    if (typeof raw === "string") {
      const d = new Date(raw);
      return isNaN(d) ? null : d;
    }
    if (typeof raw === "object") {
      if (typeof raw.toDate === "function") return toJSDate(raw.toDate());
      if ("seconds" in raw && "nanoseconds" in raw)
        return new Date(raw.seconds * 1000 + raw.nanoseconds / 1e6);
    }
  } catch {
    return null;
  }
  return null;
};

// Formatter for date cells with timezone & fallback
export const fmtDateTimeCell = (tz = "UTC", fallback = "—") => (params) => {
  const d = toJSDate(params?.value);
  if (!d) return fallback;
  try {
    return dayjs(d).tz(tz).format("MMM D, h:mm A");
  } catch {
    return fallback;
  }
};

// Plain string formatter with fallback
export const fmtPlain = (fallback = "—") => (params) => {
  const v = params?.value;
  if (v === undefined || v === null || v === "") return fallback;
  return String(v);
};

// Safely get nested property from row
export const getNested = (path, fallback = null) => (params) => {
  const row = params?.row;
  if (!row) return fallback;
  const parts = path.split(".");
  let cur = row;
  for (const p of parts) {
    if (cur == null) return fallback;
    cur = cur[p];
  }
  return cur ?? fallback;
};

// Date comparator tolerant of nulls
export const dateSort = (a, b) => {
  const ta = toJSDate(a)?.getTime() ?? 0;
  const tb = toJSDate(b)?.getTime() ?? 0;
  return ta - tb;
};

export default {
  toJSDate,
  fmtDateTimeCell,
  fmtPlain,
  getNested,
  dateSort,
};
