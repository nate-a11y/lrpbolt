/* Proprietary and confidential. See LICENSE. */
export { formatDateTime, timestampSortComparator, durationMinutes, safeNumber } from "./timeUtils";
export { vfText, vfNumber, vfBool, vfTime } from "./vf";

/** Replace undefined with null; never inject "N/A". */
export function nullifyMissing(obj = {}) {
  const out = {};
  for (const k of Object.keys(obj)) out[k] = obj[k] === undefined ? null : obj[k];
  return out;
}
