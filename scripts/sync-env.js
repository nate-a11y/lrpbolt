// scripts/sync-env.js
 
import fs from "fs";

const required = [
  "VITE_MUIX_LICENSE_KEY",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];
const optional = [
  "VITE_FIREBASE_VAPID_KEY",
  "VITE_ENABLE_FCM",
  "VITE_SHOW_DEBUG_PANELS",
  "VITE_SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
];

const target = ".env.sample";
let lines = [];
if (fs.existsSync(target)) {
  lines = fs.readFileSync(target, "utf-8").split("\n");
}
const existing = new Set(lines.map((l) => l.split("=")[0].trim()).filter(Boolean));

function ensure(key) {
  if (!existing.has(key)) {
    lines.push(`${key}=`);
    existing.add(key);
  }
}

[...required, ...optional].forEach(ensure);

// Always include a comment for SENTRY_AUTH_TOKEN
if (!lines.find((l) => l.includes("SENTRY_AUTH_TOKEN"))) {
  lines.push("# SENTRY_AUTH_TOKEN is CI-only; do not put in local files.");
}

fs.writeFileSync(target, lines.join("\n"));
console.log("✅ .env.sample synced with required/optional keys");
