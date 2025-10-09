/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import { getRides } from "../services/firestoreService";
import { COLLECTIONS } from "../constants";
import logError from "../utils/logError.js";

let ridesCache = {
  rideQueue: [],
  liveRides: [],
  claimedRides: [],
};
let countsCache = { queue: 0, live: 0, claimed: 0 };
let loading = false;
const listeners = new Set();
let initialized = false;
let hasFetchedOnce = false;

export async function fetchRides() {
  loading = true;
  listeners.forEach((cb) =>
    cb({ ...ridesCache, counts: countsCache, loading, hasFetchedOnce }),
  );

  let error;
  try {
    const [queue, live, claimed] = await Promise.all([
      getRides(COLLECTIONS.RIDE_QUEUE),
      getRides(COLLECTIONS.LIVE_RIDES),
      getRides(COLLECTIONS.CLAIMED_RIDES),
    ]);

    ridesCache = {
      rideQueue: queue,
      liveRides: live,
      claimedRides: claimed,
    };
    countsCache = {
      queue: queue.length,
      live: live.length,
      claimed: claimed.length,
    };
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    logError(error, { scope: "useRides", action: "fetchRides" });
  } finally {
    loading = false;
    hasFetchedOnce = true;
    listeners.forEach((cb) =>
      cb({
        ...ridesCache,
        counts: countsCache,
        loading,
        hasFetchedOnce,
      }),
    );
  }

  if (error) {
    throw error;
  }
}

export default function useRides() {
  const [state, setState] = useState({
    ...ridesCache,
    counts: countsCache,
    loading,
    hasFetchedOnce,
  });

  useEffect(() => {
    listeners.add(setState);
    if (!initialized) {
      initialized = true;
      fetchRides().catch((err) => {
        void err;
      });
    } else {
      setState({
        ...ridesCache,
        counts: countsCache,
        loading,
        hasFetchedOnce,
      });
    }
    return () => listeners.delete(setState);
  }, []);

  return { ...state, fetchRides };
}
