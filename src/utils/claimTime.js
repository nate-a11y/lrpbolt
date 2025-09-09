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

export function formatRange(startTs, endTs, durationMins) {
  const s = tsToDayjs(startTs);
  let e = tsToDayjs(endTs);
  if (!e && s && Number.isFinite(durationMins)) {
    e = s.add(durationMins, "minute");
  }
  if (!s || !e) return "N/A";
  return `${s.format("h:mm A")} – ${e.format("h:mm A")}`;
}

export function durationHM(startTs, endTs, durationMins) {
  const s = tsToDayjs(startTs);
  let e = tsToDayjs(endTs);
  let mins;
  if (s && e) mins = Math.max(0, e.diff(s, "minute"));
  else if (s && Number.isFinite(durationMins)) mins = durationMins;
  else return "N/A";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
