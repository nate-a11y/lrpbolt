// Proprietary and confidential.
import dayjsBase from "dayjs";
import durationPlugin from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjsBase.extend(utc);
dayjsBase.extend(timezone);
dayjsBase.extend(durationPlugin);
dayjsBase.extend(relativeTime);

export const dayjs = dayjsBase;

let defaultTz = "UTC";
try {
  if (typeof window !== "undefined" && dayjs.tz) {
    defaultTz = dayjs.tz.guess() || "UTC";
  }
} catch (error) {
  void error;
  defaultTz = "UTC";
}

/**
 * Safely convert many timestamp shapes to a dayjs() or return null.
 */
export function toDayjs(input) {
  try {
    if (input === null || input === undefined) return null;
    if (dayjs.isDayjs?.(input)) return input;

    if (typeof input === "object" && typeof input.toDate === "function") {
      const dateValue = input.toDate();
      const time = dateValue?.getTime?.();
      if (!Number.isFinite(time)) return null;
      const parsed = dayjs(time);
      return parsed.isValid() ? parsed : null;
    }

    if (input instanceof Date) {
      const time = input.getTime();
      if (!Number.isFinite(time)) return null;
      const parsed = dayjs(time);
      return parsed.isValid() ? parsed : null;
    }

    if (typeof input === "object" && "seconds" in input) {
      const seconds = Number(input.seconds);
      const nanos = Number(input.nanoseconds);
      const hasSeconds = Number.isFinite(seconds);
      const hasNanos = Number.isFinite(nanos);
      if (!hasSeconds && !hasNanos) return null;
      const ms =
        (hasSeconds ? seconds * 1000 : 0) +
        (hasNanos ? Math.floor(nanos / 1e6) : 0);
      if (!Number.isFinite(ms)) return null;
      const parsed = dayjs(ms);
      return parsed.isValid() ? parsed : null;
    }

    if (typeof input === "number") {
      if (!Number.isFinite(input)) return null;
      const parsed = dayjs(input);
      return parsed.isValid() ? parsed : null;
    }

    if (typeof input === "string") {
      const parsed = dayjs(input);
      return parsed.isValid() ? parsed : null;
    }

    return null;
  } catch (error) {
    void error;
    return null;
  }
}

export function formatDuration(ms) {
  let safeMs = Number(ms);
  if (!Number.isFinite(safeMs) || safeMs < 0) safeMs = 0;

  const totalSec = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const hh = hours > 0 ? `${hours}:` : "";
  const mm = hours > 0 ? String(mins).padStart(2, "0") : String(mins);
  const ss = String(secs).padStart(2, "0");

  return `${hh}${mm}:${ss}`;
}

export function formatDateTime(input, fmt = "MMM D, YYYY h:mm A") {
  const d = toDayjs(input);
  if (!d) return "N/A";
  try {
    const tz = dayjs.tz?.guess?.() || defaultTz;
    return d.tz(tz).format(fmt);
  } catch (error) {
    void error;
    return d.format(fmt);
  }
}

export function safeDuration(startTs, endTs) {
  const start = toDayjs(startTs);
  const end = endTs ? toDayjs(endTs) : dayjs();
  if (!start || !end || end.isBefore(start)) return "N/A";
  const mins = end.diff(start, "minute");
  if (!Number.isFinite(mins) || mins < 0) return "N/A";
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

export { dayjsBase as default };
