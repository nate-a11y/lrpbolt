import { dayjs } from "@/utils/time";

const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    return new Date(v > 1e12 ? v : v * 1000);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(+d) ? null : d;
  }
  if (v.seconds != null && v.nanoseconds != null) {
    return new Date(v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6));
  }
  if (v._seconds != null && v._nanoseconds != null) {
    return new Date(v._seconds * 1000 + Math.floor(v._nanoseconds / 1e6));
  }
  return null;
};

export const fmtDateTime = (value) => {
  const d = toDate(value);
  return d ? dayjs(d).format("MM/DD/YYYY hh:mm A") : "";
};

export const fmtMinutes = (mins) => {
  if (mins == null) return "";
  const m = Number(mins);
  if (!Number.isFinite(m)) return "";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
};

export { toDate };

export const FRIENDLY_DT = "MM/DD/YYYY hh:mm A";

export function toDayjsLegacy(input) {
  if (!input) return null;
  if (typeof input === "object") {
    if (typeof input.toDate === "function") return dayjs(input.toDate());
    if ("seconds" in input && typeof input.seconds === "number") {
      return dayjs
        .unix(input.seconds)
        .millisecond(Math.floor((input.nanoseconds || 0) / 1e6));
    }
    if (input instanceof Date) return dayjs(input);
  }
  if (typeof input === "number") return dayjs(input);
  if (typeof input === "string") return dayjs(input);
  return null;
}

export function compareDateLike(a, b) {
  const da = toDayjsLegacy(a);
  const db = toDayjsLegacy(b);
  if (!da && !db) return 0;
  if (!da) return -1;
  if (!db) return 1;
  return da.valueOf() - db.valueOf();
}

export function toDateAny(v) {
  return toDate(v);
}

export function friendlyDateTime(v) {
  const d = toDate(v);
  return d ? dayjs(d).format(FRIENDLY_DT) : "—";
}

function epoch(x) {
  const d = toDate(x);
  return d ? d.getTime() : -Infinity;
}

export function dateCol(field, headerName, extras = {}) {
  return {
    field,
    headerName,
    type: "dateTime",
    valueGetter: (params) => {
      const raw = params?.value ?? params?.row?.[field] ?? undefined;
      return toDate(raw);
    },
    valueFormatter: (params) => {
      const raw = params?.value ?? params?.row?.[field] ?? undefined;
      const d = raw instanceof Date ? raw : toDate(raw);
      return d ? dayjs(d).format(FRIENDLY_DT) : "—";
    },
    sortComparator: (a, b) => epoch(a) - epoch(b),
    editable: false,
    ...extras,
  };
}

export function durationMinutes(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return null;
  const diff = e.getTime() - s.getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff / 60000);
}
