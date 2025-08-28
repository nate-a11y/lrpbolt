/* Proprietary and confidential. See LICENSE. */

let sentryPromise;

function loadSentry() {
  if (
    !sentryPromise &&
    import.meta.env.PROD &&
    import.meta.env.VITE_SENTRY_DSN
  ) {
    sentryPromise = import("@sentry/browser")
      .then((mod) => {
        mod.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
        return mod;
      })
      .catch(() => null);
  }
  return sentryPromise;
}

export default function logError(err, ctx = {}) {
  console.error("[LRP]", ctx, err?.message || err, err?.stack);
  loadSentry()?.then((s) => s?.captureException(err));
}
