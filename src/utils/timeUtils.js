// src/utils/timeUtils.js
import dayjs from "dayjs";

export const toDayjs = (v) => {
  if (!v) return null;
  // Firestore Timestamp support
  if (typeof v.toDate === "function") v = v.toDate();
  else if (typeof v === "object" && typeof v.seconds === "number") {
    v = new Date(v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6));
  } else if (typeof v === "object" && typeof v._seconds === "number") {
    v = new Date(v._seconds * 1000 + Math.floor((v._nanoseconds || 0) / 1e6));
  }
  const d = dayjs(v);
  return d.isValid() ? d : null;
};

/**
 * Format a timestamp for display.
 * @param {*} v Firestore Timestamp | Date | string | number
 * @param {{ round?: boolean, step?: number, fmt?: string }} opts
 */
export const formatTime = (v, opts = {}) => {
  const { round = false, step = 5, fmt = "h:mm A" } = opts;
  const d = toDayjs(v);
  if (!d) return null;

  let t = d.second(0); // we never show seconds
  if (round) {
    const m = Math.round(t.minute() / step) * step;
    t = t.minute(m);
  }
  return t.format(fmt);
};

export const formatDate = (v, fmt = "MM/DD/YYYY") => {
  const d = toDayjs(v);
  return d ? d.format(fmt) : null;
};

export const formatDuration = (start, end) => {
  const s = toDayjs(start);
  const e = toDayjs(end);
  if (!s || !e) return null;

  const mins = e.diff(s, "minute");
  if (mins < 0) return null;

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

