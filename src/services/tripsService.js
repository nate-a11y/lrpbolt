/* Proprietary and confidential. See LICENSE. */
/* Trip service: transitions, claims, subscriptions */
import {
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";

import { TRIP_STATES, canTransition } from "../constants/tripStates.js";
import { COLLECTIONS } from "../constants.js";
import logError from "../utils/logError.js";

import { db } from "./firebase.js"; // must point to your initialized Firestore

const LEGACY_COLLECTION_BY_STATE = Object.freeze({
  [TRIP_STATES.QUEUED]: COLLECTIONS.RIDE_QUEUE,
  [TRIP_STATES.OPEN]: COLLECTIONS.LIVE_RIDES,
  [TRIP_STATES.CLAIMED]: COLLECTIONS.CLAIMED_RIDES,
});

const isString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const legacyClaimer = (data) => {
  if (!data || typeof data !== "object") return null;
  const candidate =
    data.claimedBy ??
    data.ClaimedBy ??
    data.claimed_by ??
    data.claimedUserId ??
    data.claimed_user_id ??
    data.claimer ??
    data.claimerId ??
    null;
  return isString(candidate) ? candidate : null;
};

const legacyCollectionForState = (state) =>
  LEGACY_COLLECTION_BY_STATE[state] || null;

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
    if (!snap.exists()) {
      return legacyTransition(tx, {
        rideId,
        from,
        to,
        userId,
        extra,
      });
    }

    const current = snap.data() || {};
    const currentState =
      current.state || current.status || current.queueStatus || from;

    if (currentState !== from) {
      if (currentState === to) return { id: rideId, ...current };
      throw new Error(
        `State mismatch for ${rideId}: expected ${from}, found ${currentState}`,
      );
    }

    const timestamp = serverTimestamp();
    const nextStatus = isString(extra?.status) ? extra.status : to;
    const next = {
      ...current,
      ...extra,
      state: to,
      status: nextStatus,
      queueStatus: isString(extra?.queueStatus)
        ? extra.queueStatus
        : to === TRIP_STATES.OPEN
          ? TRIP_STATES.OPEN
          : nextStatus,
      updatedAt: timestamp,
      updatedBy: userId,
      lastModifiedBy: userId,
    };

    if (to === TRIP_STATES.CLAIMED) {
      if (!isString(next.claimedBy) && isString(current.claimedBy)) {
        next.claimedBy = current.claimedBy;
      }
      if (isString(next.claimedBy)) {
        next.ClaimedBy = next.ClaimedBy ?? next.claimedBy;
      }
      next.claimed = true;
      next.claimedAt = next.claimedAt ?? timestamp;
      next.ClaimedAt = next.ClaimedAt ?? next.claimedAt;
    } else if (to === TRIP_STATES.OPEN) {
      next.claimed = false;
      next.claimedBy = isString(next.claimedBy) ? next.claimedBy : null;
      next.ClaimedBy = null;
      next.claimedAt = null;
      next.ClaimedAt = null;
    }

    tx.set(rideRef, next, { merge: true });

    if (liveRef) {
      if (to === TRIP_STATES.OPEN) {
        tx.set(
          liveRef,
          {
            ...next,
            rideId,
            state: TRIP_STATES.OPEN,
          },
          { merge: true },
        );
      } else {
        tx.delete(liveRef);
      }
    }

    return { id: rideId, ...next };
  }).catch((err) => {
    logError(err, { where: "transitionRideState", rideId, from, to, userId });
    throw err;
  });
}

async function legacyTransition(tx, { rideId, from, to, userId, extra = {} }) {
  const fromCollection = legacyCollectionForState(from);
  if (!fromCollection) {
    throw new Error(`Legacy collection not defined for state: ${from}`);
  }

  const fromRef = doc(db, fromCollection, rideId);
  const fromSnap = await tx.get(fromRef);
  if (!fromSnap.exists()) throw new Error(`Ride ${rideId} not found`);

  const current = fromSnap.data() || {};
  const timestamp = serverTimestamp();

  const existingClaimer = legacyClaimer(current);
  const requestedClaimer = isString(extra?.claimedBy)
    ? extra.claimedBy
    : isString(extra?.ClaimedBy)
      ? extra.ClaimedBy
      : null;

  if (from === TRIP_STATES.OPEN && to === TRIP_STATES.CLAIMED) {
    if (
      existingClaimer &&
      requestedClaimer &&
      existingClaimer !== requestedClaimer
    ) {
      throw new Error("Already claimed by another driver");
    }
  }

  if (from === TRIP_STATES.CLAIMED && to === TRIP_STATES.OPEN) {
    if (
      existingClaimer &&
      requestedClaimer &&
      existingClaimer !== requestedClaimer
    ) {
      throw new Error("Cannot undo — not claimed by this driver");
    }
  }

  const toCollection = legacyCollectionForState(to);
  const statusValue = isString(extra?.status) ? extra.status : to;
  const queueStatusValue = isString(extra?.queueStatus)
    ? extra.queueStatus
    : to === TRIP_STATES.OPEN
      ? TRIP_STATES.OPEN
      : to;

  const next = {
    ...current,
    ...extra,
    state: to,
    status: statusValue,
    queueStatus: queueStatusValue,
    QueueStatus: queueStatusValue,
    updatedAt: timestamp,
    updatedBy: userId,
    lastModifiedBy: userId,
  };

  if (!isString(next.claimedBy) && requestedClaimer) {
    next.claimedBy = requestedClaimer;
  }
  if (isString(next.claimedBy)) {
    next.ClaimedBy = next.claimedBy;
  }

  if (to === TRIP_STATES.CLAIMED) {
    next.claimed = true;
    next.claimedAt = next.claimedAt ?? timestamp;
    next.ClaimedAt = next.ClaimedAt ?? next.claimedAt;
    if (!isString(next.claimedBy) && existingClaimer) {
      next.claimedBy = existingClaimer;
      next.ClaimedBy = existingClaimer;
    }
  } else if (to === TRIP_STATES.OPEN) {
    next.claimed = false;
    next.claimedBy = null;
    next.ClaimedBy = null;
    next.claimedAt = null;
    next.ClaimedAt = null;
  } else if (to === TRIP_STATES.QUEUED) {
    next.claimed = false;
  }

  if (!next.createdAt && current.createdAt) {
    next.createdAt = current.createdAt;
  }
  if (!next.CreatedAt && current.CreatedAt) {
    next.CreatedAt = current.CreatedAt;
  }

  const toRef = toCollection ? doc(db, toCollection, rideId) : null;

  if (toRef) {
    tx.set(toRef, next, { merge: true });
    if (toRef.path !== fromRef.path) {
      tx.delete(fromRef);
    }
  } else {
    tx.set(fromRef, next, { merge: true });
  }

  return { id: rideId, ...next };
}

async function legacyDriverClaim(tx, { rideId, driverId, vehicleId, userId }) {
  const liveRef = doc(db, COLLECTIONS.LIVE_RIDES, rideId);
  const snap = await tx.get(liveRef);
  if (!snap.exists()) throw new Error(`Ride ${rideId} not found`);

  const data = snap.data() || {};
  const existingClaimer = legacyClaimer(data);
  if (existingClaimer && existingClaimer !== driverId) {
    throw new Error("Already claimed by another driver");
  }

  const timestamp = serverTimestamp();
  const next = {
    ...data,
    claimed: true,
    claimedBy: driverId,
    ClaimedBy: driverId,
    claimedAt: timestamp,
    ClaimedAt: timestamp,
    claimedVehicle: vehicleId ?? data.claimedVehicle ?? null,
    state: TRIP_STATES.CLAIMED,
    status: TRIP_STATES.CLAIMED,
    queueStatus: TRIP_STATES.CLAIMED,
    QueueStatus: TRIP_STATES.CLAIMED,
    updatedBy: userId,
    lastModifiedBy: userId,
    updatedAt: timestamp,
  };

  if (!next.createdAt && data.createdAt) {
    next.createdAt = data.createdAt;
  }
  if (!next.CreatedAt && data.CreatedAt) {
    next.CreatedAt = data.CreatedAt;
  }

  const claimedRef = doc(db, COLLECTIONS.CLAIMED_RIDES, rideId);
  tx.set(claimedRef, next, { merge: true });
  tx.delete(liveRef);

  return { id: rideId, ...next };
}

async function legacyUndoClaim(tx, { rideId, driverId, userId }) {
  const claimedRef = doc(db, COLLECTIONS.CLAIMED_RIDES, rideId);
  const snap = await tx.get(claimedRef);
  if (!snap.exists()) {
    throw new Error("Ride no longer available to undo");
  }

  const data = snap.data() || {};
  const existingClaimer = legacyClaimer(data);
  if (existingClaimer && existingClaimer !== driverId) {
    throw new Error("Cannot undo — not claimed by this driver");
  }

  const timestamp = serverTimestamp();
  const next = {
    ...data,
    claimed: false,
    claimedBy: null,
    ClaimedBy: null,
    claimedAt: null,
    ClaimedAt: null,
    claimedVehicle: null,
    state: TRIP_STATES.OPEN,
    status: TRIP_STATES.OPEN,
    queueStatus: TRIP_STATES.OPEN,
    QueueStatus: TRIP_STATES.OPEN,
    updatedBy: userId,
    lastModifiedBy: userId,
    updatedAt: timestamp,
  };

  if (!next.createdAt && data.createdAt) {
    next.createdAt = data.createdAt;
  }
  if (!next.CreatedAt && data.CreatedAt) {
    next.CreatedAt = data.CreatedAt;
  }

  const liveRef = doc(db, COLLECTIONS.LIVE_RIDES, rideId);
  tx.set(liveRef, next, { merge: true });
  tx.delete(claimedRef);

  return { id: rideId, ...next };
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
    if (!snap.exists()) {
      return legacyDriverClaim(tx, {
        rideId,
        driverId,
        vehicleId,
        userId,
      });
    }

    const data = snap.data();
    if (data.state !== TRIP_STATES.OPEN)
      throw new Error(`Ride ${rideId} not open`);
    if (data.claimedBy && data.claimedBy !== driverId)
      throw new Error("Already claimed by another driver");

    const timestamp = serverTimestamp();
    const next = {
      ...data,
      state: TRIP_STATES.CLAIMED,
      claimedBy: driverId,
      claimedAt: timestamp,
      claimedVehicle: vehicleId,
      updatedBy: userId,
      updatedAt: timestamp,
      lastModifiedBy: userId,
      claimed: true,
    };

    next.ClaimedBy = next.ClaimedBy ?? driverId;
    next.ClaimedAt = next.ClaimedAt ?? next.claimedAt;
    next.queueStatus = TRIP_STATES.CLAIMED;
    next.status = TRIP_STATES.CLAIMED;

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
    if (!snap.exists()) {
      return legacyUndoClaim(tx, { rideId, driverId, userId });
    }

    const data = snap.data();
    const claimedBy = data.claimedBy || null;
    if (data.state !== TRIP_STATES.CLAIMED || claimedBy !== driverId) {
      throw new Error("Cannot undo — not claimed by this driver");
    }

    const timestamp = serverTimestamp();
    const next = {
      ...data,
      state: TRIP_STATES.OPEN,
      claimedBy: null,
      claimedAt: null,
      updatedBy: userId,
      updatedAt: timestamp,
      lastModifiedBy: userId,
      claimed: false,
    };

    next.ClaimedBy = null;
    next.ClaimedAt = null;
    next.queueStatus = TRIP_STATES.OPEN;
    next.status = TRIP_STATES.OPEN;

    tx.set(rideRef, next, { merge: true });

    if (liveRef) {
      tx.set(
        liveRef,
        {
          ...next,
          rideId,
          state: TRIP_STATES.OPEN,
          createdAt: data?.createdAt || timestamp,
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
