/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";
export const isNil = (v) => v === null || v === undefined;
export const tsToDate = (v) => {
  if (isNil(v)) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d?.getTime()) ? null : d;
  } catch { return null; }
};
export const fmtDateTime = (v) => {
  const d = tsToDate(v);
  return d ? dayjs(d).format("MMM D, YYYY h:mm a") : "—";
};
export const diffMinutes = (s, e) => {
  const sd = tsToDate(s); const ed = tsToDate(e);
  if (!sd || !ed) return null;
  const ms = ed - sd;
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60000)) : null;
};
