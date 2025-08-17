/* Proprietary and confidential. See LICENSE. */
import { TIMEZONE } from "../constants";

import dayjs from "./dates";

/** Firestore Timestamp | {seconds,nanoseconds} | Date -> Date|null */
export function tsToDate(v) {
  try {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v.seconds === "number" && typeof v.nanoseconds === "number") {
      return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6));
    }
    const d = new Date(v);
    return isNaN(d) ? null : d;
  } catch {
    return null;
  }
}

export function fmtDateTS(v) {
  const d = tsToDate(v);
  if (!d) return "N/A";
  return dayjs(d).tz(TIMEZONE).format("MM/DD/YYYY");
}

export function fmtTimeTS(v) {
  const d = tsToDate(v);
  if (!d) return "N/A";
  return dayjs(d).tz(TIMEZONE).format("h:mm A");
}

export function minutesHHMM(v) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return "N/A";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
