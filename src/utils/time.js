/* LRP Portal enhancement: time utils shim, 2025-10-03. Rationale: single dayjs w/ utc,tz; null-safe formatters. */
import dayjs, {
  toDayjs as toDayjsCore,
  isD,
  getDefaultTimezone,
} from "./dayjsSetup.js";

export { dayjs };

export function guessUserTimezone() {
  try {
    if (dayjs.tz?.guess) {
      const tzGuess = dayjs.tz.guess();
      if (tzGuess) return tzGuess;
    }
  } catch (error) {
    void error;
  }
  return getDefaultTimezone() || "UTC";
}

function ensureTimezone(instance, tz = guessUserTimezone()) {
  if (!instance) return null;
  if (typeof instance.tz === "function" && tz) {
    try {
      return instance.tz(tz);
    } catch (error) {
      void error;
    }
  }
  return instance;
}

export function toDayjs(input, tz) {
  const targetTz = tz || guessUserTimezone();
  return ensureTimezone(toDayjsCore(input, targetTz), targetTz);
}

function coerceToDayjs(value) {
  if (value == null) return null;

  if (dayjs.isDayjs?.(value)) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return dayjs(value);
  }

  if (value instanceof Date) {
    return dayjs(value);
  }

  if (typeof value === "object") {
    if (typeof value.toMillis === "function") {
      const millis = value.toMillis();
      if (Number.isFinite(millis)) {
        return dayjs(millis);
      }
    }

    const seconds = Number(value?.seconds);
    const nanoseconds = Number(value?.nanoseconds);
    if (Number.isFinite(seconds) || Number.isFinite(nanoseconds)) {
      const millisFromSeconds = Number.isFinite(seconds) ? seconds * 1000 : 0;
      const millisFromNanos = Number.isFinite(nanoseconds)
        ? Math.floor(nanoseconds / 1e6)
        : 0;
      return dayjs(millisFromSeconds + millisFromNanos);
    }
  }

  return toDayjs(value);
}

/** Null-safe datetime string; returns "N/A" when invalid */
export function formatDateTime(ts, fmt = "MMM D, YYYY h:mm A") {
  const coerced = coerceToDayjs(ts);
  if (!coerced || !coerced.isValid?.()) {
    return "N/A";
  }

  const zoned = ensureTimezone(coerced);
  if (!zoned || !zoned.isValid?.()) {
    return "N/A";
  }

  try {
    return zoned.format(fmt);
  } catch (error) {
    void error;
    return zoned.format(fmt);
  }
}

/** Null-safe date string; returns "N/A" when invalid */
export function formatDate(ts, fmt = "MMM D, YYYY") {
  const d = toDayjs(ts);
  if (!d) return "N/A";
  try {
    return ensureTimezone(d).format(fmt);
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

export function startOfWeekLocal(reference) {
  const base = reference ? toDayjs(reference) : ensureTimezone(dayjs());
  if (!base) {
    return ensureTimezone(dayjs()).startOf("week");
  }
  try {
    const zoned = ensureTimezone(base);
    return zoned.startOf("week");
  } catch (error) {
    void error;
    return base.startOf("week");
  }
}

export function isActiveRow(row) {
  if (!row) return false;
  const status =
    row.status ?? row.state ?? (row?.endTs || row?.endTime ? "closed" : "open");
  if (status === "closed") return false;
  const start =
    row.startTs ??
    row.startTime ??
    row.clockIn ??
    row.clockInAt ??
    row.loggedAt ??
    null;
  if (!start) return false;
  const end =
    row.endTs ?? row.endTime ?? row.clockOut ?? row.clockOutAt ?? null;
  return !end;
}

export function formatClockOutOrDash(ts) {
  return ts ? formatDateTime(ts) : "—";
}

export function isValidTimestamp(input) {
  return !!toDayjs(input);
}

export { isD };

export default dayjs;
