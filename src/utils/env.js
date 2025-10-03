import AppError from "./AppError.js";

const required = {
  VITE_MUIX_LICENSE_KEY: [],
  VITE_FIREBASE_API_KEY: ["VITE_FB_API_KEY"],
  VITE_FIREBASE_PROJECT_ID: ["VITE_FB_PROJECT_ID"],
  VITE_FIREBASE_MESSAGING_SENDER_ID: [
    "VITE_FIREBASE_SENDER_ID",
    "VITE_FB_MESSAGING_SENDER_ID",
  ],
  VITE_FIREBASE_APP_ID: ["VITE_FB_APP_ID"],
};

const optional = {
  VITE_FIREBASE_AUTH_DOMAIN: ["VITE_FB_AUTH_DOMAIN"],
  VITE_FIREBASE_STORAGE_BUCKET: ["VITE_FB_STORAGE_BUCKET"],
  VITE_FIREBASE_MEASUREMENT_ID: ["VITE_FB_MEASUREMENT_ID"],
  VITE_FIREBASE_VAPID_KEY: ["VITE_FB_VAPID_KEY", "VITE_FCM_VAPID_KEY"],
  VITE_ENABLE_FCM: [],
  VITE_SHOW_DEBUG_PANELS: [],
  VITE_SENTRY_DSN: [],
  VITE_ENABLE_ERUDA: [],
};

let cached;

function resolveEnvValue(primary, aliases = []) {
  const keys = [primary, ...aliases];
  for (const key of keys) {
    const raw = import.meta?.env?.[key];
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      return raw;
    }
  }
  return undefined;
}

function assignEnvValues(target, map, { required: isRequired }) {
  const missing = [];
  Object.entries(map).forEach(([key, aliases]) => {
    const value = resolveEnvValue(key, aliases);
    if (value === undefined) {
      if (isRequired) {
        if (import.meta.env.PROD) {
          missing.push(
            `${key}${aliases.length ? ` (aliases: ${aliases.join(", ")})` : ""}`,
          );
        } else {
          const aliasLabel = aliases.length
            ? ` (aliases checked: ${aliases.join(", ")})`
            : "";
          console.warn(`[LRP] Missing env ${key}${aliasLabel}`);
        }
      }
    }
    target[key] = value;
  });
  return missing;
}

export default function getEnv() {
  if (cached) return cached;
  const env = {};
  const missing = assignEnvValues(env, required, { required: true });
  assignEnvValues(env, optional, { required: false });

  if (missing.length) {
    throw new AppError(
      `Missing env vars: ${missing.join(", ")}`,
      "ENV_MISSING",
    );
  }

  cached = env;
  return env;
}
