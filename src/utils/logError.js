/* Proprietary and confidential. See LICENSE. */

export default function logError(err, ctx = {}) {
  console.error("[LRP]", { message: err?.message || String(err), ...ctx });
}
