/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = dayjs.tz.guess();

export function toDayjs(input, tz = DEFAULT_TZ) {
  if (!input) return null;
  if (typeof input?.toDate === "function") {
    const d = input.toDate();
    const dj = dayjs(d);
    return dj.isValid() ? dj.tz(tz) : null;
  }
  if (input instanceof Date) {
    const dj = dayjs(input);
    return dj.isValid() ? dj.tz(tz) : null;
  }
  const dj = dayjs(input);
  return dj.isValid() ? dj.tz(tz) : null;
}

export function formatDateTime(input, fmt = "MMM D, YYYY h:mm A", tz = DEFAULT_TZ) {
  const dj = toDayjs(input, tz);
  if (!dj) return "N/A";
  const fmtSafe = typeof fmt === "string" ? fmt : "MMM D, YYYY h:mm A";
  try {
    return dj.format(fmtSafe);
  } catch {
    try { return dj.toISOString(); } catch { return "N/A"; }
  }
}

export function timestampSortComparator(a, b) {
  const da = toDayjs(a);
  const db = toDayjs(b);
  if (!da && !db) return 0;
  if (!da) return -1;
  if (!db) return 1;
  const diff = da.valueOf() - db.valueOf();
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

export function durationMinutes(start, end) {
  const s = toDayjs(start);
  const e = toDayjs(end);
  if (!s || !e) return null;
  const mins = e.diff(s, "minute");
  return Number.isFinite(mins) && mins >= 0 ? mins : null;
}

export function formatHMFromMinutes(mins) {
  if (typeof mins !== "number" || !Number.isFinite(mins)) return "N/A";
  const h = Math.floor(mins / 60);
  const m = Math.max(0, Math.round(mins - h * 60));
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function safeNumber(n, fallback = "N/A") {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
