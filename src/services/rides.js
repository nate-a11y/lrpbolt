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

/**
 * Patch a ride doc with only allowed keys and normalized types.
 * @param {"rideQueue"|"liveRides"|"claimedRides"} collectionName
 * @param {string} id
 * @param {Record<string,any>} patch
 * @param {string} [currentUserEmail]
 */
export async function patchRide(collectionName, id, patch, currentUserEmail) {
  const data = {};
  for (const k of Object.keys(patch || {})) {
    if (!ALLOWED.has(k)) continue;

    if (k === "pickupTime" || k === "claimedAt" || k === "importedFromQueueAt") {
      data[k] = toTimestampOrNull(patch[k]); // accepts Dayjs/Date/Timestamp/null
    } else if (k === "rideDuration") {
      const n = typeof patch[k] === "string" ? Number(patch[k]) : patch[k];
      data[k] = Number.isFinite(n) ? n : null;
    } else {
      data[k] = patch[k];
    }
  }
  data.updatedAt = serverTimestamp();
  data.lastModifiedBy = currentUserEmail || "system@lrp";

  await updateDoc(doc(db, collectionName, id), data);
}
