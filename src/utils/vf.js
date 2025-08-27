/* Proprietary and confidential. See LICENSE. */
import { formatDateTime, safeNumber } from "./timeUtils";

/** Support both DataGrid params and raw values. */
export function extractVal(paramsOrValue) {
  if (paramsOrValue && typeof paramsOrValue === "object" && "value" in paramsOrValue) {
    return paramsOrValue.value;
  }
  return paramsOrValue;
}

export function vfText(paramsOrValue, fallback = "N/A") {
  const v = extractVal(paramsOrValue);
  if (v === null || v === undefined) return fallback;
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

/** One-arg to avoid bad fmt injection. */
export function vfTime(paramsOrValue) {
  const v = extractVal(paramsOrValue);
  return formatDateTime(v);
}
