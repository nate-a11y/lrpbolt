import AppError from "./AppError.js";

const required = [
  "VITE_MUIX_LICENSE_KEY",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const optional = [
  "VITE_FIREBASE_VAPID_KEY",
  "VITE_ENABLE_FCM",
  "VITE_SHOW_DEBUG_PANELS",
  "VITE_SENTRY_DSN",
];

let cached;
export default function getEnv() {
  if (cached) return cached;
  const env = {};
  const missing = [];
  required.forEach((k) => {
    const v = import.meta.env[k];
    if (!v) {
      if (import.meta.env.PROD) {
        missing.push(k);
      } else {
        console.warn(`[LRP] Missing env ${k}`);
      }
    }
    env[k] = v;
  });
  optional.forEach((k) => {
    env[k] = import.meta.env[k];
  });
  if (missing.length) {
    throw new AppError(`Missing env vars: ${missing.join(", ")}`, "ENV_MISSING");
  }
  cached = env;
  return env;
}

