// scripts/verify-env.js
/* eslint-disable no-console */
const required = [
  "VITE_MUIX_LICENSE_KEY",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID", // alias for sender id
  "VITE_FIREBASE_APP_ID",
];
const optional = [
  "VITE_FIREBASE_VAPID_KEY",
  "VITE_ENABLE_FCM",
  "VITE_SHOW_DEBUG_PANELS",
  "VITE_SENTRY_DSN",
  "VITE_ENABLE_ERUDA",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
];

const missing = [];
required.forEach((k) => {
  if (!process.env[k]) missing.push(k);
});

if (missing.length) {
  console.error("❌ Missing required env vars:", missing.join(", "));
  process.exit(1);
} else {
  console.log("✅ Required env vars present.");
}

const seenOptional = optional.filter((k) => !!process.env[k]);
console.log("ℹ️ Optional present:", seenOptional.join(", ") || "(none)");

// Gentle hint if someone kept old key name
if (!process.env.VITE_MUIX_LICENSE_KEY && process.env.YOUR_MUI_PRO_KEY) {
  console.warn(
    "⚠️ Using YOUR_MUI_PRO_KEY – map it to VITE_MUIX_LICENSE_KEY in CI (already handled in build.yml)."
  );
}
