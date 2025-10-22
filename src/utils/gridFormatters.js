// src/utils/gridFormatters.js
import { dayjs } from "@/utils/time";

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
// MUI DataGrid v7 API: valueFormatter signature is (value, row, column, apiRef)
export function vfText(value) {
  return value == null ? "" : String(value);
}

export function vfNumber(value) {
  return value == null || Number.isNaN(value) ? "" : String(value);
}

export function vfDateTime(value) {
  const d = toDateOrNull(value);
  return d ? fmt(d) : "";
}

export function vfDuration(value) {
  if (value == null || Number.isNaN(value)) return "";
  const h = Math.floor(value / 60);
  const mm = value % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
}

// Wrap a valueGetter to be resilient to errors
// MUI v7 signature: (value, row, column, apiRef)
export const safeVG = (getter) => (value, row, column, apiRef) => {
  try {
    return getter(value, row, column, apiRef);
  } catch {
    return undefined;
  }
};

// Wrap a valueFormatter to always return a string and never throw
// MUI v7 signature: (value, row, column, apiRef)
export const safeVF = (formatter) => (value, row, column, apiRef) => {
  try {
    if (value == null) return "";
    const res = formatter(value, row, column, apiRef);
    return res == null ? "" : String(res);
  } catch (err) {
    console.warn("[Grid] valueFormatter error:", err);
    return "";
  }
};

// Safely wrap column callbacks (valueGetter/valueFormatter/renderCell)
// MUI v7 API: individual parameters instead of params object
export function withSafeColumns(columns = []) {
  return (columns || []).map((c) => {
    const col = { ...c };
    if (typeof col.valueGetter === "function") {
      col.valueGetter = safeVG(col.valueGetter);
    }
    if (typeof col.valueFormatter === "function") {
      const vf = col.valueFormatter;
      col.valueFormatter = safeVF((value, row, column, apiRef) => vf(value, row, column, apiRef));
    }
    if (typeof col.renderCell === "function") {
      const rc = col.renderCell;
      col.renderCell = (params) => {
        try {
          return rc(params);
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
