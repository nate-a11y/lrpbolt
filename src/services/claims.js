import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "@/utils/firebaseInit";
import { COLLECTIONS } from "@/constants";
import logError from "@/utils/logError";

export async function claimRideOnce(rideId, user) {
  if (!rideId) throw new Error("Missing rideId");
  if (!user) throw new Error("Missing user");
  const liveRef = doc(db, COLLECTIONS.LIVE_RIDES, rideId);
  const claimedRef = doc(db, COLLECTIONS.CLAIMED_RIDES, rideId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(liveRef);
      if (!snap.exists()) throw new Error("Ride not found");
      const data = snap.data();
      if (data.claimedBy && data.claimedBy !== user.uid)
        throw new Error("Ride already claimed");
      const payload = {
        ...data,
        claimedBy: user.uid,
        claimedAt: serverTimestamp(),
        claimedByName: user.displayName || "Unknown",
      };
      tx.set(claimedRef, payload);
      tx.delete(liveRef);
      return { id: rideId, ...payload };
    });
  } catch (err) {
    logError(err, { where: "claims", action: "claimRideOnce", rideId });
    throw err;
  }
}
