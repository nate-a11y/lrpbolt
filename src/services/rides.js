/* Proprietary and confidential. See LICENSE. */
// src/services/rides.js
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { db } from "../utils/firebaseInit";
import { toTimestampOrNull } from "../utils/dateSafe";

const ALLOWED = new Set([
  "tripId","pickupTime","rideDuration","rideType","vehicle","rideNotes",
  "claimedBy","claimedAt","ClaimedBy","ClaimedAt",
  "status","importedFromQueueAt",
  "updatedAt","lastModifiedBy"
]);

const NA_STRINGS = new Set(["N/A","NA","-",""]);

/**
 * Patch a ride doc with only allowed keys and normalized types.
 * @param {"rideQueue"|"liveRides"|"claimedRides"} collectionName
 * @param {string} id
 * @param {Record<string, any>} patch
 * @param {string} [currentUserEmail]
 */
export async function patchRide(collectionName, id, patch, currentUserEmail) {
  const data = {};
  for (const k of Object.keys(patch || {})) {
    if (!ALLOWED.has(k)) continue;

    const val = patch[k];

    // Skip placeholders
    if (typeof val === "string" && NA_STRINGS.has(val.trim())) continue;

    if (k === "pickupTime" || k === "claimedAt" || k === "importedFromQueueAt") {
      const ts = toTimestampOrNull(val); // accepts Dayjs/Date/Timestamp/null
      if (!ts) continue; // do not write invalid timestamp
      data[k] = ts;
    } else if (k === "rideDuration") {
      const n = typeof val === "string" ? Number(val) : val;
      if (!Number.isFinite(n) || n < 0) continue;
      data[k] = n;
    } else {
      data[k] = val;
    }
  }

  if (!Object.keys(data).length) return; // nothing to update

  data.updatedAt = serverTimestamp();
  data.lastModifiedBy = currentUserEmail || "system@lrp";

  await updateDoc(doc(db, collectionName, id), data);
}
