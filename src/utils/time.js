import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export function toDayjs(ts) {
  try {
    if (!ts) return null;
    if (dayjs.isDayjs(ts)) return ts;
    if (typeof ts.toDate === "function") return dayjs(ts.toDate());
    return dayjs(ts);
  } catch {
    return null;
  }
}

export function formatDate(ts, fmt = "MMM D, YYYY", tz = dayjs.tz.guess()) {
  const d = toDayjs(ts);
  if (!d) return "N/A";
  try {
    return d.tz(tz).format(fmt);
  } catch {
    return "N/A";
  }
}

export function durationSafe(startTs, endTs) {
  const start = toDayjs(startTs);
  const end = toDayjs(endTs);
  if (!start || !end) return "N/A";
  const ms = end.diff(start);
  if (!Number.isFinite(ms) || ms < 0) return "N/A";
  return ms;
}

export function toIso(ts) {
  const d = toDayjs(ts);
  if (!d) return null;
  try {
    return d.toISOString();
  } catch {
    return null;
  }
}
