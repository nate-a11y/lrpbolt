/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
dayjs.extend(utc);
dayjs.extend(timezone);

function toDayjsLoose(v) {
  if (!v) return null;
  // Firestore Timestamp-like
  if (typeof v === "object" && typeof v.seconds === "number") {
    try { return dayjs.unix(v.seconds); } catch { return null; }
  }
  // JS Date
  if (v instanceof Date) return dayjs(v);
  // numbers: ms or s
  if (typeof v === "number") {
    // assume ms if looks like ms
    return v > 1e12 ? dayjs(v) : dayjs.unix(v);
  }
  // ISO/string
  if (typeof v === "string") {
    const d = dayjs(v);
    return d.isValid() ? d : null;
  }
  return null;
}

export function formatDateTime(v, fmt = "MMM D, YYYY h:mm A") {
  const d = toDayjsLoose(v);
  return d && d.isValid() ? d.tz(dayjs.tz.guess()).format(fmt) : "N/A";
}

export function minutesBetween(start, end) {
  const s = toDayjsLoose(start);
  const e = toDayjsLoose(end);
  if (!s || !e || !s.isValid() || !e.isValid()) return 0;
  const diff = e.diff(s, "minute");
  return Number.isFinite(diff) && diff >= 0 ? diff : 0;
}

export function safeString(v, def = "N/A") {
  if (v === null || v === undefined) return def;
  const s = String(v).trim();
  return s ? s : def;
}

export function safeNumber(v, def = 0) {
  return Number.isFinite(v) ? v : def;
}

export function fmtMinutesHuman(v) {
  const m = safeNumber(v, 0);
  if (m < 60) return `${m} min`;
  const h = (m / 60).toFixed(2);
  return `${h} h`;
}
