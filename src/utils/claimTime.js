import dayjs, { toDayjs } from "@/utils/dayjsSetup.js";

export const guessTz = () => dayjs.tz?.guess?.() || "America/Chicago";

export function tsToDayjs(ts) {
  const tz = guessTz();
  const d = toDayjs(ts, tz);
  return d && d.isValid() ? d : null;
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
  const e = tsToDayjs(endTs);
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
