/* Proprietary and confidential. See LICENSE. */
export {
  formatDateTime,
  timestampSortComparator,
  durationMinutes,
  safeNumber,
  formatHMFromMinutes,
} from "./timeUtils";
export { vfText, vfNumber, vfBool, vfTime, vfDurationHM } from "./vf";

/** Replace undefined with null; never inject "N/A". */
export function nullifyMissing(obj = {}) {
  const out = {};
  for (const k of Object.keys(obj))
    out[k] = obj[k] === undefined ? null : obj[k];
  return out;
}

export function formatTripId(raw) {
  if (!raw) return "";
  const s = String(raw)
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  const left = s.slice(0, 4);
  const right = s.slice(4, 6);
  return right ? `${left}-${right}` : left;
}

export function isTripIdValid(v) {
  return /^[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(String(v || "").toUpperCase());
}
