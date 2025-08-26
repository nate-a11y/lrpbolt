import dayjs from "dayjs";

export const toDayjs = (v) => {
  if (!v) return null;
  // Firestore Timestamp
  if (typeof v?.toDate === "function") v = v.toDate();
  // seconds / nanoseconds object
  else if (typeof v === "object" && typeof v.seconds === "number") {
    v = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  } else if (typeof v === "object" && typeof v._seconds === "number") {
    v = v._seconds * 1000 + Math.floor((v._nanoseconds || 0) / 1e6);
  }
  // Epoch seconds → ms
  if (typeof v === "number" && v < 1e12) v = v * 1000;
  const d = dayjs(v);
  return d.isValid() ? d : null;
};

export const fmtDateTime = (v, fmt = "MM/DD/YYYY h:mm A") => {
  const d = toDayjs(v);
  return d ? d.format(fmt) : "—";
};

export const fmtDuration = (start, end) => {
  const s = toDayjs(start);
  const e = toDayjs(end);
  if (!s || !e) return "—";
  const mins = e.diff(s, "minute");
  if (mins < 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

