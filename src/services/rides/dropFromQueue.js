/* Proprietary and confidential. See LICENSE. */
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/services/firebase.js";
import {
  liveOpenPatch,
  normalizeStatus,
  boolFromAny,
} from "@/utils/statusUtils.js";

export async function dropRideFromQueue(queueId) {
  const qref = doc(db, "rideQueue", queueId);
  const snap = await getDoc(qref);
  if (!snap.exists()) throw new Error("Queue ride not found");
  const data = snap.data();

  const sanitized = {
    ...data,
    status: normalizeStatus(data?.status) || "open",
    claimed: boolFromAny(data?.claimed),
  };

  const liveId = sanitized.id || queueId;
  const lref = doc(db, "liveRides", liveId);

  await setDoc(
    lref,
    {
      ...sanitized,
      ...liveOpenPatch({ serverTimestamp }),
    },
    { merge: true },
  );
  await deleteDoc(qref);
  return liveId;
}
