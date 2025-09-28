// Proprietary and confidential.
import dayjsLib from "dayjs";
import durationPlugin from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import logError from "./logError.js";

dayjsLib.extend(utc);
dayjsLib.extend(timezone);
dayjsLib.extend(durationPlugin);
dayjsLib.extend(relativeTime);

let defaultTz = "UTC";
try {
  defaultTz = dayjsLib.tz?.guess?.() || "UTC";
} catch (error) {
  logError(error, { where: "utils/time.defaultTz" });
}

export const dayjs = dayjsLib;

export function toDayjs(input) {
  try {
    if (!input) return null;
    if (dayjsLib.isDayjs?.(input)) return input;
    if (typeof input?.toDate === "function") return dayjsLib(input.toDate());
    if (typeof input?.seconds === "number")
      return dayjsLib(input.seconds * 1000);
    return dayjsLib(input);
  } catch (error) {
    logError(error, { where: "utils/time.toDayjs" });
    return null;
  }
}

export function formatDateTime(input, fmt = "MMM D, YYYY h:mm A") {
  const d = toDayjs(input);
  if (!d) return "N/A";
  try {
    return dayjsLib.tz ? d.tz(defaultTz).format(fmt) : d.format(fmt);
  } catch (error) {
    logError(error, { where: "utils/time.formatDateTime" });
    return d.format(fmt);
  }
}

export function safeDuration(startTs, endTs) {
  const start = toDayjs(startTs);
  const end = endTs ? toDayjs(endTs) : dayjsLib();
  if (!start || !end || end.isBefore(start)) return "N/A";
  const minutes = end.diff(start, "minute");
  if (!Number.isFinite(minutes) || minutes < 0) return "N/A";
  if (minutes < 1) return "<1 min";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

export function formatDuration(startTs, endTs) {
  return safeDuration(startTs, endTs);
}
