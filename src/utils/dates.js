import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// Default to Central Time
try {
  dayjs.tz.setDefault("America/Chicago");
} catch (e) {
  console.warn("Timezone setDefault failed", e);
}

export function tsToDayjs(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return dayjs(ts.toDate());
  if (ts instanceof Date) return dayjs(ts);
  return dayjs(ts);
}

export function fmtDate(dj, fmt = "MMM D, YYYY") {
  const d = tsToDayjs(dj);
  return d && d.isValid() ? d.format(fmt) : "—";
}

export function fmtTime(dj, fmt = "h:mm A") {
  const d = tsToDayjs(dj);
  return d && d.isValid() ? d.format(fmt) : "—";
}

export function minutesBetween(startTs, endTs) {
  const s = tsToDayjs(startTs);
  const e = tsToDayjs(endTs);
  if (!s || !s.isValid()) return 0;
  const end = e && e.isValid() ? e : dayjs();
  const mins = Math.max(0, end.diff(s, "minute"));
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
