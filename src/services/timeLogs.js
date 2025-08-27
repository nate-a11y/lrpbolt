/* Proprietary and confidential. See LICENSE. */
// src/services/timeLogs.js
import { doc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";

import { db } from "../utils/firebaseInit";
import { logError } from "../utils/logError";

function backoff(attempt) {
  return new Promise((res) => setTimeout(res, 2 ** attempt * 100));
}

export async function patchTimeLog(id, updates = {}) {
  if (!id) return;
  const ref = doc(db, "timeLogs", id);
  const coerceTs = (v) =>
    v == null ? null : v instanceof Timestamp ? v : Timestamp.fromMillis(Number(v));

  const data = {};
  if ("driver" in updates) data.driver = updates.driver;
  if ("rideId" in updates) data.rideId = updates.rideId;
  if ("note" in updates) data.note = updates.note;
  if ("startTime" in updates) data.startTime = coerceTs(updates.startTime);
  if ("endTime" in updates) data.endTime = coerceTs(updates.endTime);

  const s = data.startTime?.toMillis?.();
  const e = data.endTime?.toMillis?.();
  if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
    data.duration = Math.floor((e - s) / 60000);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await updateDoc(ref, data);
      return;
    } catch (err) {
      if (attempt === 2) {
        logError(err, `patchTimeLog:${id}`);
        throw err;
      }
      await backoff(attempt);
    }
  }
}

export async function deleteTimeLog(id) {
  if (!id) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await deleteDoc(doc(db, "timeLogs", id));
      return;
    } catch (err) {
      if (attempt === 2) {
        logError(err, `deleteTimeLog:${id}`);
        throw err;
      }
      await backoff(attempt);
    }
  }
}
