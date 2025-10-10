/* Proprietary and confidential. See LICENSE. */
import {
  dayjs,
  toDayjs,
  formatDateTime,
  startOfWeekLocal,
  guessUserTimezone,
} from "@/utils/time";

export { dayjs, toDayjs, formatDateTime, startOfWeekLocal, guessUserTimezone };

export const guessTz = () => guessUserTimezone();

export function tsToDayjs(ts) {
  const d = toDayjs(ts);
  return d ? d.tz(guessTz()) : null;
}

export function formatRange(start, end) {
  const s = tsToDayjs(start);
  const e = tsToDayjs(end);
  if (!s || !e) return "N/A";
  return `${s.format("h:mm A")} – ${e.format("h:mm A")}`;
}

export function durationMinutes(start, end) {
  const s = tsToDayjs(start);
  const e = tsToDayjs(end);
  if (!s || !e) return null;
  const mins = e.diff(s, "minute");
  return Number.isFinite(mins) && mins >= 0 ? mins : null;
}

export function durationHM(start, end) {
  const mins = durationMinutes(start, end);
  if (typeof mins !== "number" || !Number.isFinite(mins)) return "N/A";
  const h = Math.floor(mins / 60);
  const m = Math.max(0, mins - h * 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function timestampSortComparator(a, b) {
  const da = tsToDayjs(a);
  const db = tsToDayjs(b);
  if (!da && !db) return 0;
  if (!da) return -1;
  if (!db) return 1;
  const diff = da.valueOf() - db.valueOf();
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
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

export function formatClockElapsed(ms) {
  const safeValue = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeValue / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
