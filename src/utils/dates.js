/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

// Accept Firestore Timestamp, JS Date, ISO/string, number → Dayjs or null
export function tsToDayjs(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return dayjs(ts.toDate());
  if (
    typeof ts === "object" &&
    typeof ts.seconds === "number" &&
    typeof ts.nanoseconds === "number"
  ) {
    return dayjs(new Date(ts.seconds * 1000 + ts.nanoseconds / 1e6));
  }
  if (ts instanceof Date) return dayjs(ts);
  return dayjs(ts); // ISO/string/number
}

export function isValidDayjs(d) {
  return !!d && dayjs.isDayjs(d) && d.isValid();
}

export function fmtDate(d, fmt = "MMM D, YYYY") {
  const dj = tsToDayjs(d);
  return dj && dj.isValid() ? dj.format(fmt) : "—";
}
export function fmtTime(d, fmt = "h:mm A") {
  const dj = tsToDayjs(d);
  return dj && dj.isValid() ? dj.format(fmt) : "—";
}
export function fmtDateTime(d) {
  const dj = tsToDayjs(d);
  return dj && dj.isValid()
    ? `${dj.format("MMM D, YYYY")} ${dj.format("h:mm A")}`
    : "—";
}

export function minutesBetween(startTs, endTs) {
  const s = tsToDayjs(startTs);
  const e = tsToDayjs(endTs) || dayjs();
  if (!s || !s.isValid()) return 0;
  const mins = Math.max(0, e.diff(s, "minute"));
  return Number.isFinite(mins) ? mins : 0;
}

export function humanDuration(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  if (r === 0) return `${h} hr`;
  return `${h} hr ${r} min`;
}

export default dayjs;
