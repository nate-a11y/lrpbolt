// src/utils/timeUtils.js
import dayjsLib from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjsLib.extend(utc); dayjsLib.extend(tz);

const TZ = "America/Chicago";

// Accept: Firestore Timestamp | {seconds,nanoseconds} | Date | ISO | ms | seconds
function coerceDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate();
    } catch (err) {
      void err;
      /* no-op for hot reload */
    }
  }
  if (typeof value === "object") {
    const s = value.seconds ?? value._seconds;
    const ns = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (typeof s === "number") return new Date(s * 1000 + Math.floor(ns / 1e6));
  }
  // Handle numeric epoch values: treat numbers less than 1e12 as seconds
  // and anything larger as milliseconds. Previously we used a 2e12 threshold
  // which misclassified millisecond timestamps (≈1.7e12) as seconds, leading
  // to invalid dates and grids showing em dashes instead of times.
  if (typeof value === "number")
    return value < 1e12 ? new Date(value * 1000) : new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  return null;
}

function toDayjs(value, tzName = TZ) {
  const d = coerceDate(value);
  if (!d) return null;
  const j = tzName ? dayjsLib(d).tz(tzName) : dayjsLib(d);
  return j.isValid() ? j : null;
}

function durationMinutesFloor(start, end, tzName = TZ) {
  const s = toDayjs(start, tzName), e = toDayjs(end, tzName);
  if (!s || !e) return null;
  const s0 = s.second(0).millisecond(0), e0 = e.second(0).millisecond(0);
  if (e0.isBefore(s0)) return null;
  return Math.floor(e0.diff(s0) / 60000);
}

function durationHumanFloor(start, end, tzName = TZ) {
  const m = durationMinutesFloor(start, end, tzName);
  if (m == null) return "—";
  const h = Math.floor(m / 60), r = m % 60;
  return `${h}h ${r}m`;
}

function formatLocalShort(value, tzName = TZ) {
  const d = toDayjs(value, tzName);
  return d ? d.format("MMM D, h:mm A") : "—";
}

function coerceDatePublic(v) {
  const j = toDayjs(v);
  return j ? j.toDate() : null;
}

export {
  toDayjs,
  durationMinutesFloor,
  durationHumanFloor,
  formatLocalShort,
  coerceDatePublic,
};
