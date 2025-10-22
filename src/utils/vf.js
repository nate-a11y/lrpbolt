/* Proprietary and confidential. See LICENSE. */
import { formatDateTime, safeNumber, formatHMFromMinutes } from "./timeUtils";

/**
 * MUI DataGrid v7 API: valueFormatter signature is (value, row, column, apiRef)
 * All formatters now receive the value directly as the first parameter
 */

/** Blank for objects/arrays; "N/A" only for null/undefined. */
export function vfText(value, _row, _column, _apiRef, fallback = "N/A") {
  // Support direct value calls for backward compatibility
  const v = arguments.length === 1 || typeof value !== "object" || value === null ? value : value;
  if (v === null || v === undefined) return fallback;
  if (typeof v === "object") return fallback; // guard against objects/arrays
  const s = String(v);
  return s.trim() === "" ? fallback : s;
}

export function vfNumber(value, _row, _column, _apiRef, fallback = "N/A") {
  return safeNumber(value, fallback);
}

export function vfBool(value, _row, _column, _apiRef, fallback = "N/A") {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return fallback;
}

/** One-arg only (prevents bad fmt injection) */
export function vfTime(value) {
  return formatDateTime(value);
}

/** Minutes -> "Hh Mm" (also accepts {minutes} or {hours,minutes}) */
export function vfDurationHM(value) {
  if (typeof value === "number") return formatHMFromMinutes(value);
  if (value && typeof value === "object") {
    if (typeof value.minutes === "number") return formatHMFromMinutes(value.minutes);
    if (typeof value.hours === "number") {
      const mins = (value.hours || 0) * 60 + (value.mins || value.minutes || 0);
      return formatHMFromMinutes(mins);
    }
  }
  return "N/A";
}
