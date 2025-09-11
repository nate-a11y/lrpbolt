/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import { getRides } from "../services/firestoreService";
import { COLLECTIONS } from "../constants";

let ridesCache = {
  rideQueue: [],
  liveRides: [],
  claimedRides: [],
};
let countsCache = { queue: 0, live: 0, claimed: 0 };
let loading = false;
const listeners = new Set();
let initialized = false;

export async function fetchRides() {
  loading = true;
  listeners.forEach((cb) => cb({ ...ridesCache, counts: countsCache, loading }));
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
  loading = false;
  listeners.forEach((cb) =>
    cb({ ...ridesCache, counts: countsCache, loading }),
  );
}

export default function useRides() {
  const [state, setState] = useState({
    ...ridesCache,
    counts: countsCache,
    loading,
  });

  useEffect(() => {
    listeners.add(setState);
    if (!initialized) {
      initialized = true;
      fetchRides();
    } else {
      setState({ ...ridesCache, counts: countsCache, loading });
    }
    return () => listeners.delete(setState);
  }, []);

  return { ...state, fetchRides };
}
