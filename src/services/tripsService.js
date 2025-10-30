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
import { COLLECTIONS } from "../constants.js";

import { db } from "./firebase.js"; // must point to your initialized Firestore

/** Collection names — adjust if your repo uses different names. */
const RIDES_COLLECTION = "rides";
/** Optional shadow collection when OPEN: comment out if unused. */
const LIVE_RIDES_COLLECTION = "liveRides";
/** Optional shadow collection when CLAIMED: comment out if unused. */
const CLAIMED_RIDES_COLLECTION = "claimedRides";
const QUEUE_COLLECTION = COLLECTIONS.RIDE_QUEUE || "rideQueue";

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
 * Shadow collections:
 * - Mirrors to LIVE_RIDES_COLLECTION when to===OPEN; removes when leaving OPEN.
 * - Mirrors to CLAIMED_RIDES_COLLECTION when to===CLAIMED; removes when leaving CLAIMED.
 */
export async function transitionRideState(
  rideId,
  from,
  to,
  { userId = "system", extra = {}, queueId: providedQueueId = null } = {},
) {
  const normalizedFrom = typeof from === "string" ? from.toLowerCase() : from;
  const normalizedTo = typeof to === "string" ? to.toLowerCase() : to;

  if (!canTransition(normalizedFrom, normalizedTo)) {
    throw new Error(
      `Invalid state transition ${normalizedFrom} → ${normalizedTo}`,
    );
  }

  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  const liveRef = LIVE_RIDES_COLLECTION
    ? doc(db, LIVE_RIDES_COLLECTION, rideId)
    : null;
  const claimedRef = CLAIMED_RIDES_COLLECTION
    ? doc(db, CLAIMED_RIDES_COLLECTION, rideId)
    : null;
  const queueId = providedQueueId || rideId;
  const queueRef =
    normalizedFrom === TRIP_STATES.QUEUED && queueId
      ? doc(db, QUEUE_COLLECTION, queueId)
      : null;

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(rideRef);
    let current = snap.exists() ? snap.data() : null;

    if (!current && queueRef) {
      const queueSnap = await tx.get(queueRef);
      if (!queueSnap.exists()) throw new Error(`Ride ${rideId} not found`);
      const queueData = queueSnap.data() || {};
      current = {
        ...queueData,
        id: queueData.id || rideId,
        rideId: queueData.rideId || queueData.id || rideId,
        tripId: queueData.tripId || queueData.id || rideId,
        queueId,
      };
    } else if (!current) {
      throw new Error(`Ride ${rideId} not found`);
    }

    const stateCandidate =
      typeof current?.state === "string"
        ? current.state.toLowerCase()
        : current?.state;
    const statusCandidate =
      typeof current?.status === "string"
        ? current.status.toLowerCase()
        : current?.status;

    const currentState =
      stateCandidate ||
      statusCandidate ||
      (normalizedFrom === TRIP_STATES.QUEUED
        ? TRIP_STATES.QUEUED
        : normalizedFrom);

    if (currentState !== normalizedFrom) {
      // Allow idempotency if it's already at the target
      if (currentState === normalizedTo) return { id: rideId, ...current };
      throw new Error(
        `State mismatch for ${rideId}: expected ${normalizedFrom}, found ${currentState}`,
      );
    }

    const timestamp = serverTimestamp();
    const next = {
      ...current,
      ...extra,
      queueId,
      state: normalizedTo,
      status: normalizedTo,
      queueStatus: normalizedTo,
      updatedAt: timestamp,
      updatedBy: userId,
    };

    tx.set(rideRef, next, { merge: true });

    if (queueRef) {
      tx.delete(queueRef);
    }

    // Shadow handling for liveRides
    if (liveRef) {
      if (normalizedTo === TRIP_STATES.OPEN) {
        const livePayload = {
          ...next,
          id: rideId,
          rideId,
          queueId,
          createdAt:
            current?.createdAt ||
            current?.created_at ||
            current?.created ||
            timestamp,
          updatedAt: timestamp,
          state: TRIP_STATES.OPEN,
          status: TRIP_STATES.OPEN,
        };
        tx.set(liveRef, livePayload, { merge: true });
      } else {
        // Leaving OPEN removes shadow, if it exists
        tx.delete(liveRef);
      }
    }

    // Shadow handling for claimedRides
    if (claimedRef) {
      if (normalizedTo === TRIP_STATES.CLAIMED) {
        const claimedPayload = {
          ...next,
          id: rideId,
          rideId,
          queueId,
          createdAt:
            current?.createdAt ||
            current?.created_at ||
            current?.created ||
            timestamp,
          updatedAt: timestamp,
          state: TRIP_STATES.CLAIMED,
          status: TRIP_STATES.CLAIMED,
        };
        tx.set(claimedRef, claimedPayload, { merge: true });
      } else if (normalizedFrom === TRIP_STATES.CLAIMED) {
        // Leaving CLAIMED removes shadow, if it exists
        tx.delete(claimedRef);
      }
    }

    return { id: rideId, ...next };
  }).catch((err) => {
    logError(err, {
      where: "transitionRideState",
      rideId,
      from: normalizedFrom,
      to: normalizedTo,
      userId,
      queueId: providedQueueId || rideId,
    });
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
  { vehicleId = null, userId = "system", driverName = null } = {},
) {
  const rideRef = doc(db, RIDES_COLLECTION, rideId);
  const liveRef = LIVE_RIDES_COLLECTION
    ? doc(db, LIVE_RIDES_COLLECTION, rideId)
    : null;
  const claimedRef = CLAIMED_RIDES_COLLECTION
    ? doc(db, CLAIMED_RIDES_COLLECTION, rideId)
    : null;

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(rideRef);
    if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);

    const data = snap.data();
    if (data.state !== TRIP_STATES.OPEN)
      throw new Error(`Ride ${rideId} not open`);
    if (data.claimedBy && data.claimedBy !== driverId)
      throw new Error("Already claimed by another driver");

    const timestamp = serverTimestamp();
    const next = {
      ...data,
      state: TRIP_STATES.CLAIMED,
      status: TRIP_STATES.CLAIMED,
      claimedBy: driverId,
      claimedAt: timestamp,
      claimedVehicle: vehicleId,
      updatedBy: userId,
      updatedAt: timestamp,
    };

    tx.set(rideRef, next, { merge: true });

    if (liveRef) {
      tx.delete(liveRef);
    }

    // Create shadow document in claimedRides collection
    if (claimedRef) {
      const claimedPayload = {
        ...next,
        id: rideId,
        rideId,
        claimedByName: driverName || driverId,
        createdAt:
          data?.createdAt || data?.created_at || data?.created || timestamp,
        updatedAt: timestamp,
      };
      tx.set(claimedRef, claimedPayload, { merge: true });
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
  const claimedRef = CLAIMED_RIDES_COLLECTION
    ? doc(db, CLAIMED_RIDES_COLLECTION, rideId)
    : null;

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(rideRef);
    if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);

    const data = snap.data();
    const claimedBy = data.claimedBy || null;
    if (data.state !== TRIP_STATES.CLAIMED || claimedBy !== driverId) {
      throw new Error("Cannot undo — not claimed by this driver");
    }

    const timestamp = serverTimestamp();
    const next = {
      ...data,
      state: TRIP_STATES.OPEN,
      status: TRIP_STATES.OPEN,
      claimedBy: null,
      claimedAt: null,
      claimedVehicle: null,
      updatedBy: userId,
      updatedAt: timestamp,
    };

    tx.set(rideRef, next, { merge: true });

    // Delete from claimedRides shadow collection
    if (claimedRef) {
      tx.delete(claimedRef);
    }

    // Recreate in liveRides shadow collection
    if (liveRef) {
      const livePayload = {
        ...next,
        id: rideId,
        rideId,
        state: TRIP_STATES.OPEN,
        status: TRIP_STATES.OPEN,
        createdAt: data?.createdAt || data?.created_at || data?.created || timestamp,
        updatedAt: timestamp,
      };
      tx.set(liveRef, livePayload, { merge: true });
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
