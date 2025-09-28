// Proprietary and confidential.
import dayjsLib from "dayjs";
import durationPlugin from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjsLib.extend(utc);
dayjsLib.extend(timezone);
dayjsLib.extend(durationPlugin);
dayjsLib.extend(relativeTime);

export const dayjs = dayjsLib;

let defaultTz = "UTC";
try {
  if (typeof window !== "undefined" && dayjs.tz) {
    defaultTz = dayjs.tz.guess() || "UTC";
  }
} catch {
  defaultTz = "UTC";
}

export function toDayjs(input) {
  if (!input) return null;
  if (dayjs.isDayjs?.(input)) return input;
  if (typeof input?.toDate === "function") {
    try {
      const converted = dayjs(input.toDate());
      return converted.isValid() ? converted : null;
    } catch {
      return null;
    }
  }
  if (
    input &&
    typeof input === "object" &&
    typeof input.seconds === "number" &&
    typeof input.nanoseconds === "number"
  ) {
    try {
      const millis = input.seconds * 1000 + Math.floor(input.nanoseconds / 1e6);
      const converted = dayjs(millis);
      return converted.isValid() ? converted : null;
    } catch {
      return null;
    }
  }
  if (typeof input?.seconds === "number") {
    const millis =
      input.seconds * 1000 + Math.floor((input.nanoseconds || 0) / 1e6);
    const converted = dayjs(millis);
    return converted.isValid() ? converted : null;
  }
  const converted = dayjs(input);
  return converted.isValid() ? converted : null;
}

export function formatDuration(startTs, endTs) {
  const label = safeDuration(startTs, endTs);
  return label === "N/A" ? "—" : label;
}

export function formatDateTime(input, fmt = "MMM D, YYYY h:mm A") {
  const d = toDayjs(input);
  if (!d) return "N/A";
  try {
    const tz = dayjs.tz?.guess?.() || defaultTz;
    return d.tz(tz).format(fmt);
  } catch {
    return d.format(fmt);
  }
}

export function safeDuration(startTs, endTs) {
  const start = toDayjs(startTs);
  const end = endTs ? toDayjs(endTs) : dayjs();
  if (!start || !end || end.isBefore(start)) return "N/A";
  const mins = end.diff(start, "minute");
  if (mins < 1) return "<1 min";
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function isActiveRow(row) {
  const start = row?.startTime ?? row?.clockIn ?? row?.loggedAt;
  const end = row?.endTime ?? row?.clockOut;
  return !!start && !end;
}

export function formatClockOutOrDash(ts) {
  return ts ? formatDateTime(ts) : "—";
}

export { dayjsLib as default };
