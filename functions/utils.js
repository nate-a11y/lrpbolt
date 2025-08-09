// functions/utils.js
/* Proprietary and confidential. See LICENSE. */
import { db } from "./src/admin.js";
import { FieldValue } from "firebase-admin/firestore";
import { TIMEZONE } from "./constants.js";

export function formatDate(dateObject) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: true,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(dateObject);
}

export function normalizeHeader(header) {
  return header
    .toString()
    .trim()
    .replace(/[^A-Za-z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toLowerCase());
}

export async function logClaimFailure(tripId, driverName, reason) {
  await db.collection("claim_failures").add({
    tripId,
    driverName,
    reason,
    attemptedAt: FieldValue.serverTimestamp(),
  });
}

