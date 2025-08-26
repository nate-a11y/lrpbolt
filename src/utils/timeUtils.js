/* Proprietary and confidential. See LICENSE. */
// Updated timeUtils.js
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { TIMEZONE } from "../constants";

import { logError } from "./logError";

dayjs.extend(utc);
dayjs.extend(timezone);

const CST = TIMEZONE;

export const normalizeDate = (date) => {
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.tz(CST).format("MM/DD/YYYY") : date;
};

export const normalizeTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return "";
  const trimmed = timeStr.trim().toUpperCase();
  // Explicitly enforce AM/PM format
  const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
  if (timeMatch) {
    const normalized = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;
    return normalized;
  }

  return timeStr;
};

export const formatDate = (val) => {
  const parsed = dayjs.tz(val, ["YYYY-MM-DD", dayjs.ISO_8601], TIMEZONE);
  return parsed.isValid() ? parsed.format("MMM D, YYYY") : val;
};

export const formatTime = (val) => {
  const input = val?.includes("T") ? val : `2000-01-01 ${val}`;
  const parsed = dayjs.tz(input, [dayjs.ISO_8601, "YYYY-MM-DD HH:mm", "YYYY-MM-DD h:mm A", "h:mm A", "H:mm", "HH:mm"], TIMEZONE);
  return parsed.isValid() ? parsed.format("h:mm A") : val;
};

export const calculateDropOff = (pickup, duration) => {
  try {
    if (!pickup || !duration) return "N/A";

    const timeMatch = pickup.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
    if (!timeMatch) return "Invalid time";

    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const isPM = timeMatch[3].toUpperCase() === "PM";
    const hour24 = (hour % 12) + (isPM ? 12 : 0);

    const pickupDT = dayjs.tz("2000-01-01", CST).hour(hour24).minute(minute);

    const hr = parseInt(duration.match(/\b(\d+)\s*hr\b/i)?.[1] || 0);
    const min = parseInt(duration.match(/\b(\d+)\s*min\b/i)?.[1] || 0);

    const dropoff = pickupDT.add(hr, "hour").add(min, "minute");
    return dropoff.format("h:mm A");
  } catch (err) {
    logError(err, "timeUtils:calculateDropOff");
    return "N/A";
  }
};

export function durationFormat(minutes) {
  if (!minutes || isNaN(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const formatDuration = (h, m) => {
  const hh = parseInt(h || 0, 10);
  const mm = parseInt(m || 0, 10);
  return `${hh ? `${hh} hr` : ""}${hh && mm ? " " : ""}${mm ? `${mm} min` : ""}`.trim();
};

export const parseDuration = (str) => {
  const hrMatch = /(?:(\d+)\s*hr)/.exec(str);
  const minMatch = /(?:(\d+)\s*min)/.exec(str);
  return {
    hours: hrMatch ? parseInt(hrMatch[1]) : 0,
    minutes: minMatch ? parseInt(minMatch[1]) : 0,
  };
};

export const toTimeString12Hr = (t) => {
  if (!t) return "";
  const parsed = dayjs.tz(`2000-01-01 ${t}`, ["h:mm A", "H:mm", "HH:mm"], TIMEZONE);
  return parsed.isValid() ? parsed.format("h:mm A") : t;
};

// Persist sync timestamp in localStorage.
export function setSyncTime(value) {
  try {
    localStorage.setItem('lrp_sync_time', String(value ?? ''));
  } catch (e) {
    console.warn('[timeUtils] setSyncTime failed', e);
  }
}

// Retrieve sync timestamp from localStorage.
export function getSyncTime() {
  try {
    const v = localStorage.getItem('lrp_sync_time');
    return v || '';
  } catch {
    return '';
  }
}

// Null-safe Firestore Timestamp -> milliseconds conversion
export const tsToMillis = (ts) =>
  ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null;

// Timezone-aware helpers for Shootout stats and similar features
const TZ = "America/Chicago";

export function toDayjs(value, tzName = TZ) {
  if (!value) return dayjs.invalid();
  const d = value?.toDate ? value.toDate() : value;
  return dayjs(d).tz(tzName);
}

export function durationMinutesFloor(start, end, tzName = TZ) {
  const s = toDayjs(start, tzName).second(0).millisecond(0);
  const e = toDayjs(end, tzName).second(0).millisecond(0);
  if (!s.isValid() || !e.isValid() || e.isBefore(s)) return null;
  return Math.floor(e.diff(s) / 60000);
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
  if (!d.isValid()) return "—";
  return d.format("MMM D, h:mm A");
}
