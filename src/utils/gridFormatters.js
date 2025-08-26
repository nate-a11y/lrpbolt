// src/utils/gridFormatters.js
import dayjs from "dayjs";

const fmt = (d) => dayjs(d).format("MM/DD/YYYY hh:mm A");

// Accept Firestore Timestamp | Date | number(ms) | ISO string
export function toDateOrNull(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : new Date(t);
  }
  if (typeof v === "object" && typeof v.toDate === "function") return v.toDate();
  return null;
}

// ---------- valueFormatters (null-safe) ----------
export function vfText(params) {
  const v = params?.value;
  return v == null ? "" : String(v);
}

export function vfNumber(params) {
  const v = params?.value;
  return v == null || Number.isNaN(v) ? "" : String(v);
}

export function vfDateTime(params) {
  const d = toDateOrNull(params?.value);
  return d ? fmt(d) : "";
}

export function vfDuration(params) {
  const m = params?.value;
  if (m == null || Number.isNaN(m)) return "";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
}

// Wrap a valueGetter to be resilient to null params
export const safeVG = (getter) => (params) => {
  try {
    if (!params) return undefined;
    return getter(params);
  } catch {
    return undefined;
  }
};

// Reusable actions column factory (avoids “__actions not found”)
export const actionsCol = (render) => ({
  field: "__actions",
  headerName: "Actions",
  sortable: false,
  filterable: false,
  width: 120,
  renderCell: (p) => (render ? render(p) : null),
});

