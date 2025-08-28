import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

import { TIMEZONE } from "../constants";
dayjs.extend(utc);
dayjs.extend(timezone);

export const safe = (v, fallback = "—") =>
  v === null || v === undefined || v === "" ? fallback : v;

export const fmtDate = (ts) =>
  ts
    ? dayjs(ts.toDate ? ts.toDate() : ts)
        .tz(TIMEZONE)
        .format("MM/DD/YYYY")
    : "—";

export const fmtTime = (ts) =>
  ts
    ? dayjs(ts.toDate ? ts.toDate() : ts)
        .tz(TIMEZONE)
        .format("h:mm A")
    : "—";

export const fmtDow = (ts) =>
  ts
    ? dayjs(ts.toDate ? ts.toDate() : ts)
        .tz(TIMEZONE)
        .format("dddd")
    : "—";

export const fmtDurationHM = (mins) => {
  if (typeof mins !== "number" || Number.isNaN(mins)) return "00:00";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

// Group key by local date
export const groupKey = (ts) =>
  ts
    ? dayjs(ts.toDate ? ts.toDate() : ts)
        .tz(TIMEZONE)
        .startOf("day")
        .format("YYYY-MM-DD")
    : "unknown";
