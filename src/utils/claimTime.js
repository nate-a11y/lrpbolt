import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const guessTz = () => dayjs.tz.guess();

export function tsToDayjs(ts) {
  if (!ts) return null;
  try {
    const ms = typeof ts.toMillis === "function" ? ts.toMillis() : Number(ts);
    if (!Number.isFinite(ms)) return null;
    return dayjs(ms).tz(guessTz());
  } catch {
    return null;
  }
}

export function formatRange(startTs, endTs) {
  const s = tsToDayjs(startTs);
  const e = tsToDayjs(endTs);
  if (!s || !e) return "N/A";
  return `${s.format("h:mm A")} – ${e.format("h:mm A")}`;
}

export function durationHM(startTs, endTs) {
  const s = tsToDayjs(startTs);
  const e = tsToDayjs(endTs);
  if (!s || !e) return "N/A";
  const mins = Math.max(0, e.diff(s, "minute"));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
