let Sentry;
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  // eslint-disable-next-line import/no-unresolved
  import("@sentry/browser")
    .then((mod) => {
      Sentry = mod;
      Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
    })
    .catch(() => {});
}

export default function logError(err, ctx = {}) {
  console.error("[LRP]", ctx, err?.message || err, err?.stack);
  try {
    Sentry?.captureException(err);
  } catch {
    // ignore
  }
}

