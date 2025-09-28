// Proprietary and confidential.
import dayjs from "dayjs";
import durationPlugin from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(durationPlugin);
dayjs.extend(relativeTime);

let defaultTz = "UTC";
try {
  if (typeof window !== "undefined" && dayjs.tz)
    defaultTz = dayjs.tz.guess() || "UTC";
} catch {
  /* keep UTC */
}

export function toDayjs(input) {
  try {
    if (!input) return null;
    if (dayjs.isDayjs?.(input)) return input;
    if (typeof input?.toDate === "function") return dayjs(input.toDate());
    if (typeof input?.seconds === "number") return dayjs(input.seconds * 1000);
    return dayjs(input);
  } catch {
    return null;
  }
}

export function formatDuration(startTs, endTs) {
  // Convert timestamps defensively using toDayjs helper.
  const start = toDayjs(startTs);
  const end = toDayjs(endTs) || dayjs();
  if (!start || !end || end.isBefore(start)) return "—";
  const diffMs = Math.max(end.diff(start), 0);
  const diffDuration = dayjs.duration(diffMs);
  const totalMinutes = Math.max(Math.floor(diffDuration.asMinutes()), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = hours ? `${hours}h ` : "";
  return `${hourLabel}${minutes}m`.trim();
}

export function formatDateTime(input, fmt = "MMM D, YYYY h:mm A") {
  const d = toDayjs(input);
  if (!d) return "—";
  try {
    return dayjs.tz ? d.tz(defaultTz).format(fmt) : d.format(fmt);
  } catch {
    return d.format(fmt);
  }
}

export { dayjs };
