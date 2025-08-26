import dayjs from "dayjs";

export const FRIENDLY_DT = "MM/DD/YYYY hh:mm A";

// Accept Firestore Timestamp, JS Date, epoch (ms|sec), ISO/string -> Date|null
export function toDateAny(v) {
  if (!v) return null;

  // Firestore Timestamp-like
  if (typeof v === "object") {
    if (v && typeof v.toDate === "function") return v.toDate();
    if (v && typeof v.seconds === "number") return new Date(Math.trunc(v.seconds * 1000));
    if (v instanceof Date) return v;
  }

  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);

  if (typeof v === "string") {
    const d = dayjs(v);
    return d.isValid() ? d.toDate() : null;
  }

  return null;
}

export function friendlyDateTime(v) {
  const d = toDateAny(v);
  return d ? dayjs(d).format(FRIENDLY_DT) : "—";
}

function epoch(x) {
  if (!x) return -Infinity;
  if (x instanceof Date) return x.getTime();
  const d = toDateAny(x);
  return d ? d.getTime() : -Infinity;
}

// Standard dateTime column for MUI DataGrid (defensive)
export function dateCol(field, headerName, extras = {}) {
  return {
    field,
    headerName,
    type: "dateTime",

    // ⬇︎ Guard everything – grid might call this before rows exist
    valueGetter: (params) => {
      const raw =
        params?.value ??
        params?.row?.[field] ?? // if your wrapper injects row
        undefined;
      return toDateAny(raw);
    },

    valueFormatter: (params) => {
      const raw =
        params?.value ??
        params?.row?.[field] ??
        undefined;
      const d = raw instanceof Date ? raw : toDateAny(raw);
      return d ? dayjs(d).format(FRIENDLY_DT) : "—";
    },

    sortComparator: (a, b) => epoch(a) - epoch(b),

    editable: false,
    ...extras,
  };
}

// Duration helper (expects start/end in any supported type)
export function durationMinutes(start, end) {
  const s = toDateAny(start);
  const e = toDateAny(end);
  if (!s || !e) return null;
  const diff = e.getTime() - s.getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff / 60000);
}

