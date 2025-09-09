import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "@/utils/firebaseInit";
import { COLLECTIONS } from "@/constants";

export async function claimRideOnce(rideId, user) {
  if (!rideId) throw new Error("Missing rideId");
  if (!user) throw new Error("Missing user");
  const ref = doc(db, COLLECTIONS.LIVE_RIDES, rideId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Ride not found");
    const data = snap.data();
    if (data.claimedBy && data.claimedBy !== user.uid)
      throw new Error("Ride already claimed");
    tx.update(ref, {
      claimedBy: user.uid,
      claimedAt: serverTimestamp(),
      claimedByName: user.displayName || "Unknown",
    });
    return { id: rideId, ...data };
  });
}
