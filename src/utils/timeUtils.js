// src/utils/timeUtils.js
import dayjsLib from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjsLib.extend(utc);
dayjsLib.extend(tz);

const TZ = "America/Chicago";

// Normalize Firestore Timestamp | Date | {seconds,nanoseconds} | string to dayjs or null
export function toDayjs(value, tzName = TZ) {
  if (!value) return null;
  let raw = value;
  if (typeof value?.toDate === "function") {
    raw = value.toDate();
  } else if (
    typeof value === "object" &&
    typeof value.seconds === "number" &&
    typeof value.nanoseconds === "number"
  ) {
    raw = new Date(value.seconds * 1000 + value.nanoseconds / 1e6);
  }
  const d = dayjsLib(raw);
  if (!d.isValid()) return null;
  return tzName ? d.tz(tzName) : d;
}

// Truncate seconds/millis and FLOOR the diff (never round up)
export function durationMinutesFloor(start, end, tzName = TZ) {
  const s = toDayjs(start, tzName);
  const e = toDayjs(end, tzName);
  if (!s || !e) return null;
  const s0 = s.second(0).millisecond(0);
  const e0 = e.second(0).millisecond(0);
  if (e0.isBefore(s0)) return null;
  return Math.floor(e0.diff(s0) / 60000);
}

export function durationHumanFloor(start, end, tzName = TZ) {
  const mins = durationMinutesFloor(start, end, tzName);
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function formatLocalShort(value, tzName = TZ) {
  const d = toDayjs(value, tzName);
  return d ? d.format("MMM D, h:mm A") : "—";
}
