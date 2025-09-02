import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// Export the default portal timezone (Central); fall back to guess if needed.
export const DEFAULT_TZ = "America/Chicago";

// Existing exports (keep them if already present)
export function toV8Model(input) {
  if (!input) return { ids: new Set(), type: "include" };
  if (Array.isArray(input)) return { ids: new Set(input), type: "include" };
  if (input instanceof Set) return { ids: new Set(input), type: "include" };
  if (typeof input === "object") {
    const rawIds = input.ids;
    let idsSet;
    if (rawIds instanceof Set) idsSet = new Set(rawIds);
    else if (Array.isArray(rawIds)) idsSet = new Set(rawIds);
    else if (rawIds && Array.isArray(rawIds.current))
      idsSet = new Set(rawIds.current);
    else if (input.id != null) idsSet = new Set([input.id]);
    else idsSet = new Set();
    const type = input.type === "exclude" ? "exclude" : "include";
    return { ids: idsSet, type };
  }
  return { ids: new Set(), type: "include" };
}

export function selectedCount(model) {
  const ids = model?.ids;
  if (ids instanceof Set) return ids.size;
  if (Array.isArray(ids)) return ids.length;
  return 0;
}

// --- Firestore Timestamp detection ---
export function isFsTimestamp(v) {
  return !!(
    v &&
    (typeof v?.toDate === "function" ||
      (typeof v?.seconds === "number" && typeof v?.nanoseconds === "number"))
  );
}

// --- Robust parser: FS Timestamp, ISO string, millis, seconds ---
export function toDayjs(value, tz = DEFAULT_TZ) {
  try {
    if (!value) return null;
    // Trim accidental surrounding quotes: "2025-08-24T00:00:00Z"
    if (typeof value === "string") {
      const s = value.replace(/^"+|"+$/g, "");
      const d = dayjs(s);
      return d.isValid() ? d.tz(tz) : null;
    }
    if (isFsTimestamp(value)) {
      const d =
        typeof value.toDate === "function"
          ? dayjs(value.toDate())
          : dayjs(new Date(value.seconds * 1000));
      return d.isValid() ? d.tz(tz) : null;
    }
    if (typeof value === "number") {
      // Treat as millis if big, seconds if small
      const ms = value > 10_000_000_000 ? value : value * 1000;
      const d = dayjs(ms);
      return d.isValid() ? d.tz(tz) : null;
    }
    const d = dayjs(value);
    return d.isValid() ? d.tz(tz) : null;
  } catch {
    return null;
  }
}

// Friendly time formatter in Central
export function formatTs(value, fmt = "MMM D, h:mm a", tz = DEFAULT_TZ) {
  const d = toDayjs(value, tz);
  return d ? d.format(fmt) : "N/A";
}

// Keep old name for any existing callers
export function formatMaybeTs(v, tz = DEFAULT_TZ) {
  return formatTs(v, "YYYY-MM-DD HH:mm", tz);
}

// --- Duration helpers ---
export function minutesToHuman(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n) || n < 0) return "N/A";
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  if (h && m) return `${h}h ${m}min`;
  if (h && !m) return `${h}h 0min`;
  return `${m}min`;
}

export function diffMinutes(start, end, tz = DEFAULT_TZ) {
  const s = toDayjs(start, tz);
  const e = toDayjs(end, tz);
  if (!s || !e) return null;
  const diff = e.diff(s, "minute");
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

// Safe stringify for objects in cells
export function stringifyCell(value) {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (isFsTimestamp(value)) return formatTs(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
