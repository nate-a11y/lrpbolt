/* Proprietary and confidential. See LICENSE. */
export const DEBUG_TIMECLOCK =
  String(import.meta?.env?.VITE_DEBUG_TIMECLOCK || "").toLowerCase() === "true";
