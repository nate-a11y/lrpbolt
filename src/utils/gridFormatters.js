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
  if (typeof v === "object" && typeof v.toDate === "function")
    return v.toDate();
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

// Wrap a valueFormatter to always return a string and never throw
export const safeVF = (formatter) => (params) => {
  try {
    const v = params?.value;
    if (v == null) return "";
    const res = formatter(params);
    return res == null ? "" : String(res);
  } catch (err) {
    console.warn("[Grid] valueFormatter error:", err);
    return "";
  }
};

// Safely wrap column callbacks (valueGetter/valueFormatter/renderCell)
export function withSafeColumns(columns = []) {
  return (columns || []).map((c) => {
    const col = { ...c };
    if (typeof col.valueGetter === "function") {
      col.valueGetter = safeVG(col.valueGetter);
    }
    if (typeof col.valueFormatter === "function") {
      const vf = col.valueFormatter;
      col.valueFormatter = safeVF((p) => vf(p));
    }
    if (typeof col.renderCell === "function") {
      const rc = col.renderCell;
      col.renderCell = (p) => {
        try {
          return rc(p);
        } catch (err) {
          console.warn("[Grid] renderCell error:", err);
          return null;
        }
      };
    }
    return col;
  });
}

// Debug utility: warn when rows are missing fields referenced by columns
export function warnMissingFields(columns = [], rows = []) {
  try {
    const fields = columns.map((c) => c.field).filter(Boolean);
    const missing = new Set();
    rows.forEach((r) => {
      fields.forEach((f) => {
        if (r?.[f] === undefined) missing.add(f);
      });
    });
    if (missing.size) {
      console.warn("[Grid] Missing fields:", Array.from(missing));
    }
  } catch (err) {
    console.warn("[Grid] warnMissingFields error:", err);
  }
}

// Reusable actions column factory (avoids “__actions not found”)
export const actionsCol = (render) => ({
  field: "__actions",
  headerName: "Actions",
  sortable: false,
  filterable: false,
  width: 120,
  renderCell: (p) => (render ? render(p) : null),
});
