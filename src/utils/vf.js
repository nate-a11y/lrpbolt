/* Proprietary and confidential. See LICENSE. */
import { formatDateTime, safeNumber, formatHMFromMinutes } from "./timeUtils";

export function extractVal(paramsOrValue) {
  if (
    paramsOrValue &&
    typeof paramsOrValue === "object" &&
    "value" in paramsOrValue
  ) {
    return paramsOrValue.value;
  }
  return paramsOrValue;
}

/** Blank for objects/arrays; "N/A" only for null/undefined. */
export function vfText(paramsOrValue, fallback = "N/A") {
  const v = extractVal(paramsOrValue);
  if (v === null || v === undefined) return fallback;
  if (typeof v === "object") return ""; // no [object Object] on the grids
  const s = String(v);
  return s.trim() === "" ? fallback : s;
}

export function vfNumber(paramsOrValue, fallback = "N/A") {
  const v = extractVal(paramsOrValue);
  return safeNumber(v, fallback);
}

export function vfBool(paramsOrValue, fallback = "N/A") {
  const v = extractVal(paramsOrValue);
  if (v === true) return "Yes";
  if (v === false) return "No";
  return fallback;
}

/** One-arg only (prevents bad fmt injection) */
export function vfTime(paramsOrValue) {
  const v = extractVal(paramsOrValue);
  return formatDateTime(v);
}

/** Minutes -> "Hh Mm" (also accepts {minutes} or {hours,minutes}) */
export function vfDurationHM(paramsOrValue) {
  const v = extractVal(paramsOrValue);
  if (typeof v === "number") return formatHMFromMinutes(v);
  if (v && typeof v === "object") {
    if (typeof v.minutes === "number") return formatHMFromMinutes(v.minutes);
    if (typeof v.hours === "number") {
      const mins = (v.hours || 0) * 60 + (v.mins || v.minutes || 0);
      return formatHMFromMinutes(mins);
    }
  }
  return "N/A";
}
