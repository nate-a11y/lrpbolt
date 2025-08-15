import dayjs from "dayjs";

export const toDateSafe = (ts) => {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

export const fmtDateTime = (ts) => {
  const d = toDateSafe(ts);
  return d ? dayjs(d).format("MMM D, YYYY h:mm A") : "—";
};

export const durationMs = (start, end) => {
  const s = toDateSafe(start);
  const e = toDateSafe(end);
  if (!s || !e) return 0;
  const ms = e.getTime() - s.getTime();
  return ms > 0 ? ms : 0;
};

export const fmtDuration = (ms) => {
  if (!ms || ms <= 0) return "0 min";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};
