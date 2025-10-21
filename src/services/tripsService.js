/* Proprietary and confidential. See LICENSE. */
/* Trip service: transitions, claims, subscriptions */
import {
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";

import { TRIP_STATES, canTransition } from "../constants/tripStates.js";
import logError from "../utils/logError.js";

import { db } from "./firebase.js"; // must point to your initialized Firestore

/** Collection names — adjust if your repo uses different names. */
const RIDES_COLLECTION = "rides";
/** Optional shadow collection when OPEN: comment out if unused. */
const LIVE_RIDES_COLLECTION = "liveRides";

/** Get a ride by id (throws if missing). */
export async function getRideById(rideId) {
  const ref = doc(db, RIDES_COLLECTION, rideId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);
  return { id: snap.id, ...snap.data() };
}

/**
 * Transition ride.state with a Firestore transaction.
 * Writes:
 * - rides/{rideId}.state = to
 * - rides/{rideId}.updatedAt = serverTimestamp()
 * - rides/{rideId}.updatedBy = userId (if provided)
 * Mirrors to LIVE_RIDES_COLLECTION when to===OPEN; removes when leaving OPEN.
 */
export async function transitionRideState(
  rideId,
  from,
  to,
  { userId = "system", extra = {} } = {},
) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition ${from} → ${to}`);
  }

  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  const liveRef = LIVE_RIDES_COLLECTION
    ? doc(db, LIVE_RIDES_COLLECTION, rideId)
    : null;

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(rideRef);
    if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);

    const current = snap.data();
    const currentState = current?.state || TRIP_STATES.QUEUED;

    if (currentState !== from) {
      // Allow idempotency if it's already at the target
      if (currentState === to) return { id: rideId, ...current };
      throw new Error(
        `State mismatch for ${rideId}: expected ${from}, found ${currentState}`,
      );
    }

    const next = {
      ...current,
      ...extra,
      state: to,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    tx.set(rideRef, next, { merge: true });

    // Shadow handling for liveRides
    if (liveRef) {
      if (to === TRIP_STATES.OPEN) {
        tx.set(
          liveRef,
          {
            rideId,
            state: TRIP_STATES.OPEN,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        // Leaving OPEN removes shadow, if it exists
        tx.delete(liveRef);
      }
    }

    return { id: rideId, ...next };
  }).catch((err) => {
    logError(err, { where: "transitionRideState", rideId, from, to, userId });
    throw err;
  });
}

/** Shorthands */
export function moveQueuedToOpen(rideId, opts) {
  return transitionRideState(
    rideId,
    TRIP_STATES.QUEUED,
    TRIP_STATES.OPEN,
    opts,
  );
}
export function claimOpenRide(rideId, { driverId, userId = "system" }) {
  return transitionRideState(rideId, TRIP_STATES.OPEN, TRIP_STATES.CLAIMED, {
    userId,
    extra: { claimedBy: driverId, claimedAt: serverTimestamp() },
  });
}

/** Claim a ride with guard — denies double-claim. */
export async function driverClaimRide(
  rideId,
  driverId,
  { vehicleId = null, userId = "system" } = {},
) {
  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  const liveRef = LIVE_RIDES_COLLECTION
    ? doc(db, LIVE_RIDES_COLLECTION, rideId)
    : null;

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(rideRef);
    if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);

    const data = snap.data();
    if (data.state !== TRIP_STATES.OPEN)
      throw new Error(`Ride ${rideId} not open`);
    if (data.claimedBy && data.claimedBy !== driverId)
      throw new Error("Already claimed by another driver");

    const next = {
      ...data,
      state: TRIP_STATES.CLAIMED,
      claimedBy: driverId,
      claimedAt: serverTimestamp(),
      claimedVehicle: vehicleId,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    tx.set(rideRef, next, { merge: true });

    if (liveRef) {
      tx.delete(liveRef);
    }

    return { id: rideId, ...next };
  }).catch((err) => {
    logError(err, { where: "driverClaimRide", rideId, driverId, userId });
    throw err;
  });
}

/** Undo a claim — return ride to OPEN. */
export async function undoDriverClaim(
  rideId,
  driverId,
  { userId = "system" } = {},
) {
  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  const liveRef = LIVE_RIDES_COLLECTION
    ? doc(db, LIVE_RIDES_COLLECTION, rideId)
    : null;

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(rideRef);
    if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);

    const data = snap.data();
    const claimedBy = data.claimedBy || null;
    if (data.state !== TRIP_STATES.CLAIMED || claimedBy !== driverId) {
      throw new Error("Cannot undo — not claimed by this driver");
    }

    const next = {
      ...data,
      state: TRIP_STATES.OPEN,
      claimedBy: null,
      claimedAt: null,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    tx.set(rideRef, next, { merge: true });

    if (liveRef) {
      tx.set(
        liveRef,
        {
          rideId,
          state: TRIP_STATES.OPEN,
          createdAt: data?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    return { id: rideId, ...next };
  }).catch((err) => {
    logError(err, { where: "undoDriverClaim", rideId, driverId, userId });
    throw err;
  });
}
export function completeClaimedRide(rideId, opts) {
  return transitionRideState(
    rideId,
    TRIP_STATES.CLAIMED,
    TRIP_STATES.COMPLETED,
    opts,
  );
}
export function cancelRide(
  rideId,
  from,
  { reason = "unspecified", userId = "system" } = {},
) {
  return transitionRideState(rideId, from, TRIP_STATES.CANCELED, {
    userId,
    extra: { cancelReason: reason },
  });
}
