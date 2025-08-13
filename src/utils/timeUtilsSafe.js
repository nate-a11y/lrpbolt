/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";

export const isNil = (v) => v === null || v === undefined;

export const tsToDate = (v) => {
  if (isNil(v)) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d?.getTime()) ? null : d;
  } catch {
    return null;
  }
};

export const fmtDateTime = (v) => {
  const d = tsToDate(v);
  return d ? dayjs(d).format("MMM D, YYYY h:mm a") : "—";
};

export const diffMinutes = (start, end) => {
  const s = tsToDate(start);
  const e = tsToDate(end);
  if (!s || !e) return null;
  const ms = e - s;
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null;
};
