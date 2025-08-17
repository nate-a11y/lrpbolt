/* Proprietary and confidential. See LICENSE. */
import { TIMEZONE } from "../constants";

import dayjs from "./dates";

/** Firestore Timestamp | {seconds,nanoseconds} | Date | ISO | ms-epoch -> Date|null */
export function tsToDate(v) {
  try {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v.toDate === "function") return v.toDate(); // Firestore Timestamp
    if (typeof v.seconds === "number" && typeof v.nanoseconds === "number") {
      return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6));
    }
    const d = new Date(v);
    return isNaN(d) ? null : d;
  } catch {
    return null;
  }
}

export function fmtDate(d) {
  const dt = tsToDate(d);
  return dt ? dayjs(dt).tz(TIMEZONE).format("MM/DD/YYYY") : "N/A";
}

export function fmtTime(d) {
  const dt = tsToDate(d);
  return dt ? dayjs(dt).tz(TIMEZONE).format("h:mm A") : "N/A";
}

export function hhmm(minutes) {
  const n = typeof minutes === "number" ? minutes : Number(minutes);
  if (!Number.isFinite(n) || n < 0) return "00:00";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
