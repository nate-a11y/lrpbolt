import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "@/utils/firebaseInit";
import { COLLECTIONS } from "@/constants";
import logError from "@/utils/logError";

function normalizeEmail(value) {
  if (!value) return "";
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }
  if (typeof value === "object") {
    const candidate =
      value.email ||
      value.primaryEmail ||
      value.loginEmail ||
      value.userEmail ||
      value.contactEmail ||
      value.uid ||
      value.id;
    return candidate ? normalizeEmail(candidate) : "";
  }
  return String(value || "")
    .trim()
    .toLowerCase();
}

function extractUserEmail(user) {
  if (!user || typeof user !== "object") return "";
  const candidate =
    user.email ||
    user.primaryEmail ||
    user.loginEmail ||
    user.userEmail ||
    user.contactEmail ||
    user.claims?.email ||
    user.profile?.email ||
    "";
  if (typeof candidate !== "string") return "";
  return candidate.trim().toLowerCase();
}

function resolveDriverName(user, fallbackEmail) {
  if (!user || typeof user !== "object") return fallbackEmail || "Unknown";
  const rawName =
    user.displayName ||
    user.name ||
    user.fullName ||
    user.full_name ||
    user.driverName ||
    user.preferredName ||
    user.claims?.name ||
    user.profile?.name ||
    "";
  const trimmed = typeof rawName === "string" ? rawName.trim() : "";
  if (trimmed) return trimmed;
  return fallbackEmail || "Unknown";
}

export async function claimRideOnce(rideId, user) {
  if (!rideId) throw new Error("Missing rideId");
  if (!user) throw new Error("Missing user");
  const email = extractUserEmail(user);
  if (!email) throw new Error("Missing user email");
  const displayName = resolveDriverName(user, email);
  const liveRef = doc(db, COLLECTIONS.LIVE_RIDES, rideId);
  const claimedRef = doc(db, COLLECTIONS.CLAIMED_RIDES, rideId);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(liveRef);
      if (!snap.exists()) throw new Error("Ride not found");
      const data = snap.data();
      const existingClaimer = normalizeEmail(
        data.claimedBy || data.ClaimedBy || data.claimed_user,
      );
      if (existingClaimer && existingClaimer !== email)
        throw new Error("Ride already claimed");
      const payload = {
        ...data,
        claimedBy: email,
        ClaimedBy: email,
        claimedAt: serverTimestamp(),
        claimedByName: displayName,
        lastModifiedBy: email,
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

export async function undoClaimRide(rideId, user) {
  if (!rideId) throw new Error("Missing rideId");
  const claimedRef = doc(db, COLLECTIONS.CLAIMED_RIDES, rideId);
  const liveRef = doc(db, COLLECTIONS.LIVE_RIDES, rideId);
  const userEmail = extractUserEmail(user);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(claimedRef);
      if (!snap.exists()) throw new Error("Ride no longer available to undo");
      const data = snap.data() || {};
      const existingClaimer = normalizeEmail(
        data.claimedBy || data.ClaimedBy || data.claimed_user,
      );
      if (existingClaimer && userEmail && existingClaimer !== userEmail) {
        throw new Error("Another driver has already claimed this ride");
      }
      const payload = {
        ...data,
        claimed: false,
        claimedBy: null,
        ClaimedBy: null,
        claimedByName: null,
        claimedAt: null,
        status: "unclaimed",
        updatedAt: serverTimestamp(),
        lastModifiedBy: userEmail || data.lastModifiedBy || null,
      };
      tx.set(liveRef, payload, { merge: true });
      tx.delete(claimedRef);
      return { id: rideId, ...payload };
    });
  } catch (err) {
    logError(err, { where: "claims", action: "undoClaimRide", rideId });
    throw err;
  }
}
