/* Proprietary and confidential. See LICENSE. */

export default function logError(err, context = {}) {
  const msg = err?.message || String(err ?? "Unknown error");
  const isWebChannelNoise =
    /webchannel|Listen\/channel|Write\/channel/i.test(msg) &&
    typeof navigator !== "undefined" &&
    navigator &&
    navigator.onLine === false;

  if (isWebChannelNoise && import.meta.env.DEV) {
    console.debug("[LRP][dev-only webchannel]", msg, context);
    return;
  }

  console.error("[LRP]", {
    message: msg,
    ...context,
    error: err?.stack || err,
  });
}
