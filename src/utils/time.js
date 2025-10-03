/* LRP Portal enhancement: time utils shim, 2025-10-03. Rationale: single dayjs w/ utc,tz; null-safe formatters. */
import dayjsLib from "dayjs";
import durationPlugin from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

if (!dayjsLib.prototype.$lrpUtcPatched) {
  dayjsLib.extend(utc);
  dayjsLib.extend(timezone);
  dayjsLib.extend(durationPlugin);
  dayjsLib.extend(relativeTime);
  // mark once to avoid double-extend in HMR
  dayjsLib.prototype.$lrpUtcPatched = true;
}

export const dayjs = dayjsLib;

let defaultTz = "UTC";
try {
  if (typeof window !== "undefined" && dayjs.tz) {
    defaultTz = dayjs.tz.guess() || "UTC";
  }
} catch (error) {
  void error;
  defaultTz = "UTC";
}

export function toDayjs(input) {
  try {
    if (input === null || input === undefined) return null;
    if (dayjs.isDayjs?.(input)) return input;

    if (typeof input === "object" && typeof input.toDate === "function") {
      const dateValue = input.toDate();
      const parsed = dayjs(dateValue);
      return parsed.isValid() ? parsed : null;
    }

    if (input instanceof Date) {
      const parsed = dayjs(input);
      return parsed.isValid() ? parsed : null;
    }

    if (
      typeof input === "object" &&
      ("seconds" in input || "nanoseconds" in input)
    ) {
      const seconds = Number(input.seconds);
      const nanos = Number(input.nanoseconds);
      const hasSeconds = Number.isFinite(seconds);
      const hasNanos = Number.isFinite(nanos);
      if (!hasSeconds && !hasNanos) return null;
      const ms =
        (hasSeconds ? seconds * 1000 : 0) +
        (hasNanos ? Math.floor(nanos / 1e6) : 0);
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

/** Null-safe datetime string; returns "N/A" when invalid */
export function formatDateTime(ts, fmt = "MMM D, YYYY h:mm A") {
  const d = toDayjs(ts);
  if (!d) return "N/A";
  try {
    const tz = dayjs.tz?.guess?.() || defaultTz;
    return d.tz(tz).format(fmt);
  } catch (error) {
    void error;
    return d.format(fmt);
  }
}

/** Null-safe date string; returns "N/A" when invalid */
export function formatDate(ts, fmt = "MMM D, YYYY") {
  const d = toDayjs(ts);
  if (!d) return "N/A";
  try {
    const tz = dayjs.tz?.guess?.() || defaultTz;
    return d.tz(tz).format(fmt);
  } catch (error) {
    void error;
    return d.format(fmt);
  }
}

/** Duration in ms; guards both ends, never negative; null -> 0 */
export function durationSafe(startTs, endTs) {
  const s = toDayjs(startTs);
  const e = toDayjs(endTs);
  if (!s || !e) return 0;
  const diff = e.diff(s);
  return diff > 0 ? diff : 0;
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

export function formatDateTimeLegacy(input, fmt = "MMM D, YYYY h:mm A") {
  return formatDateTime(input, fmt);
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

export function isValidTimestamp(input) {
  return !!toDayjs(input);
}

export { dayjsLib as default };
