/* Proprietary and confidential. See LICENSE. */

const isDev = !!import.meta.env?.DEV;

function isWebChannelNoise(message) {
  if (!message) return false;
  return (
    /webchannel|Listen\/channel|Write\/channel/i.test(message) &&
    typeof navigator !== "undefined" &&
    navigator?.onLine === false
  );
}

export function logError(context = {}, err) {
  const error = err ?? context?.error ?? null;
  const message = error?.message || String(error ?? "Unknown error");

  if (isWebChannelNoise(message) && isDev) {
    console.debug("[LRP][dev-only webchannel]", message, context);
    return;
  }

  const payload = {
    message,
    ...context,
    error: error?.stack || error || message,
  };

  console.error("[LRP]", payload);
}

export default function logErrorDefault(err, context = {}) {
  const ctx = context && typeof context === "object" ? context : {};
  logError(ctx, err);
}
