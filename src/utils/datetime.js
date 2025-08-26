import dayjs from "dayjs";

// one place to control the friendly format:
export const FRIENDLY_DT = "MM/DD/YYYY hh:mm A";

// Accepts Firestore Timestamp, JS Date, epoch (ms|sec), ISO/string -> Date | null
export function toDateAny(v) {
  if (!v) return null;

  // Firestore Timestamp
  if (typeof v === "object" && v !== null) {
    if (typeof v.toDate === "function") return v.toDate();
    if ("seconds" in v && typeof v.seconds === "number") {
      // Timestamps sometimes arrive as plain objects {seconds,nanoseconds}
      return new Date(Math.trunc(v.seconds * 1000));
    }
  }

  // Numbers (assume ms; if it's too small, treat as seconds)
  if (typeof v === "number") {
    return new Date(v < 1e12 ? v * 1000 : v);
  }

  // Strings (ISO or Date-parsable)
  if (typeof v === "string") {
    const d = dayjs(v);
    return d.isValid() ? d.toDate() : null;
  }

  return null;
}

// For renderers only – never mutates, just formats
export function friendlyDateTime(v) {
  const d = toDateAny(v);
  return d ? dayjs(d).format(FRIENDLY_DT) : "—";
}

// Standard dateTime column for MUI DataGrid
export function dateCol(field, headerName, extras = {}) {
  return {
    field,
    headerName,
    type: "dateTime",
    // Normalize whatever we get into a real Date so sorting/filtering works
    valueGetter: (params) => toDateAny(params.value),
    valueFormatter: (params) => (params.value ? dayjs(params.value).format(FRIENDLY_DT) : "—"),
    sortComparator: (a, b) => {
      const ta = a instanceof Date ? a.getTime() : -Infinity;
      const tb = b instanceof Date ? b.getTime() : -Infinity;
      return ta - tb;
    },
    // never edit inline via text; we have dialogs for that
    editable: false,
    ...extras,
  };
}

// Duration helper (expects start/end in any supported type)
export function durationMinutes(start, end) {
  const s = toDateAny(start);
  const e = toDateAny(end);
  if (!s || !e) return null;
  const diffMs = e.getTime() - s.getTime();
  if (!Number.isFinite(diffMs)) return null;
  const mins = Math.round(diffMs / 60000);
  return mins < 0 ? null : mins;
}
