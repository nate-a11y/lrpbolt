import dayjs, { toDayjs } from "@/utils/dayjsSetup.js";

function fromTs(ts) {
  return toDayjs(ts);
}

export function formatTz(ts, fmt = "MMM D, YYYY h:mm A z") {
  const d = fromTs(ts);
  if (!d || !d.isValid()) return "N/A";
  const tz = dayjs.tz?.guess?.();
  if (tz) {
    return d.tz(tz).format(fmt);
  }
  return d.format(fmt);
}

export function durationHm(startTs, endTs) {
  const s = fromTs(startTs);
  const e = fromTs(endTs);
  if (!s || !s.isValid()) return "N/A";
  const end = e && e.isValid() ? e : dayjs();
  const ms = end.diff(s, "millisecond");
  if (ms < 0) return "N/A";
  const totalM = Math.floor(ms / 60000);
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  if (h <= 0 && m <= 0) return "0m";
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function friendlyTzLabel() {
  const guess = dayjs.tz?.guess?.();
  if (!guess) return "";
  const map = {
    "America/Chicago": "Central Time",
    "America/New_York": "Eastern Time",
    "America/Denver": "Mountain Time",
    "America/Los_Angeles": "Pacific Time",
  };
  return map[guess] || guess.replace("_", " ");
}
