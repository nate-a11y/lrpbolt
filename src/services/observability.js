/* LRP Portal enhancement: observability, 2025-10-03 */
/* global __APP_VERSION__ */
import { logError as _logError, AppError } from "@/services/errors";

let Sentry = null;
let sentryInited = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || sentryInited) return false;
  try {
    return import("@sentry/browser")
      .then((mod) => {
        Sentry = mod;
        Sentry.init({
          dsn,
          tracesSampleRate: 0.1,
          release:
            import.meta.env.VITE_RELEASE ||
            (typeof __APP_VERSION__ !== "undefined"
              ? __APP_VERSION__
              : "0.0.0"),
          environment: import.meta.env.VITE_ENV || "dev",
          integrations: (integrations) => integrations,
        });
        sentryInited = true;
        return true;
      })
      .catch((err) => {
        if (import.meta.env.VITE_ENV !== "prod") {
          const wrapped =
            err instanceof Error ? err : new AppError(String(err));
          _logError(wrapped, { where: "observability.initSentry.import" });
        }
        return false;
      });
  } catch (err) {
    if (import.meta.env.VITE_ENV !== "prod") {
      const wrapped = err instanceof Error ? err : new AppError(String(err));
      _logError(wrapped, { where: "observability.initSentry" });
    }
    return false;
  }
}

/** Structured app log – always safe; forwards to Sentry if available */
export function logEvent(event, context = {}) {
  const payload = { event, ...context };
  if (import.meta.env.VITE_ENV !== "prod") {
    console.info("[LRP:event]", payload);
  }
  if (sentryInited && Sentry) {
    Sentry.addBreadcrumb({ category: "event", level: "info", data: payload });
  }
}

/** Error capture utility: logs to console, Sentry if enabled */
export function captureError(err, context = {}) {
  const wrapped = err instanceof Error ? err : new AppError(String(err));
  _logError(wrapped, context);
  if (sentryInited && Sentry) {
    Sentry.withScope((scope) => {
      scope.setContext("context", context || {});
      Sentry.captureException(wrapped);
    });
  }
}

/** Feature flags (env + localStorage) */
const defaults = {
  "diag.panel": true,
  "grid.debug": false,
};
export function getFlag(name) {
  try {
    const fromLs = localStorage.getItem(`lrp:flag:${name}`);
    if (fromLs === "true") return true;
    if (fromLs === "false") return false;
  } catch (err) {
    if (import.meta.env.VITE_ENV !== "prod") {
      const wrapped = err instanceof Error ? err : new AppError(String(err));
      _logError(wrapped, { where: "observability.getFlag.localStorage", name });
    }
  }
  const fromEnv = import.meta.env[
    `VITE_FLAG_${name.replace(/\./g, "_").toUpperCase()}`
  ];
  if (fromEnv === "true") return true;
  if (fromEnv === "false") return false;
  return !!defaults[name];
}
export function setFlag(name, value) {
  try {
    localStorage.setItem(`lrp:flag:${name}`, String(!!value));
  } catch (err) {
    if (import.meta.env.VITE_ENV !== "prod") {
      const wrapped = err instanceof Error ? err : new AppError(String(err));
      _logError(wrapped, {
        where: "observability.setFlag.localStorage",
        name,
        value,
      });
    }
  }
}
