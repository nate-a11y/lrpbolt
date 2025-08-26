import { fmtDateTime, fmtMinutes } from "./datetime";

// Wrap valueGetter so it never throws
export const safeVG = (getter) => (params) => {
  try {
    if (!params?.row) return null;
    const v = getter(params);
    return v == null ? null : v;
  } catch (err) {
    console.warn("[Grid] valueGetter error:", err);
    return null;
  }
};

// Wrap valueFormatter so it never throws and always returns a string
export const safeVF = (formatter) => (params) => {
  try {
    const v = params?.value;
    return v == null ? "" : String(formatter(v, params) ?? "");
  } catch (err) {
    console.warn("[Grid] valueFormatter error:", err);
    return "";
  }
};

// Shortcuts for common columns
export const textCol = (field, headerName, getter) => ({
  field,
  headerName,
  flex: 1,
  valueGetter: getter ? safeVG(getter) : undefined,
});

export const dateTimeCol = (field, headerName, getter) => ({
  field,
  headerName,
  type: "dateTime",
  valueGetter: getter ? safeVG(getter) : undefined,
  valueFormatter: safeVF((v) => fmtDateTime(v)),
});

export const durationCol = (field, headerName, getter) => ({
  field,
  headerName,
  width: 110,
  align: "right",
  headerAlign: "right",
  valueGetter: getter ? safeVG(getter) : undefined,
  valueFormatter: safeVF((v) => fmtMinutes(v)),
});

// Legacy helpers
export const val = (p) => p ?? {};
export const row = (p) => (p && p.row) ? p.row : undefined;
