/* Proprietary and confidential. See LICENSE. */
import { formatDateTime, safeNumber } from "./timeUtils";

/** Extract a value whether `params` or raw value was passed. */
export function extractVal(paramsOrValue) {
  // DataGrid calls valueFormatter(params) — but we also support raw value.
  if (paramsOrValue && typeof paramsOrValue === "object" && "value" in paramsOrValue) {
    return paramsOrValue.value;
  }
  return paramsOrValue;
}

/** Null-safe text: empty -> "N/A" */
export function vfText(paramsOrValue, fallback = "N/A") {
  const v = extractVal(paramsOrValue);
  if (v === null || v === undefined) return fallback;
  const s = String(v);
  return s.trim() === "" ? fallback : s;
}

/** Null-safe number: non-finite -> "N/A" */
export function vfNumber(paramsOrValue, fallback = "N/A") {
  const v = extractVal(paramsOrValue);
  return safeNumber(v, fallback);
}

/** Null-safe boolean -> "Yes"/"No"/"N/A" */
export function vfBool(paramsOrValue, fallback = "N/A") {
  const v = extractVal(paramsOrValue);
  if (v === true) return "Yes";
  if (v === false) return "No";
  return fallback;
}

/** Null-safe timestamp using dayjs; invalid/null -> "N/A" */
export function vfTime(paramsOrValue, fmt = "MMM D, YYYY h:mm A") {
  const v = extractVal(paramsOrValue);
  return formatDateTime(v, fmt);
}
