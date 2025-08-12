/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";

import {
  getRideQueue,
  getLiveRides,
  getClaimedRides,
} from "../services/firestoreService";

let ridesCache = {
  rideQueue: [],
  liveRides: [],
  claimedRides: [],
};
let countsCache = { queue: 0, live: 0, claimed: 0 };
const listeners = new Set();
let initialized = false;

export async function fetchRides() {
  const [queue, live, claimed] = await Promise.all([
    getRideQueue(),
    getLiveRides(),
    getClaimedRides(),
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
  listeners.forEach((cb) => cb({ ...ridesCache, counts: countsCache }));
}

export default function useRides() {
  const [state, setState] = useState({ ...ridesCache, counts: countsCache });

  useEffect(() => {
    listeners.add(setState);
    if (!initialized) {
      initialized = true;
      fetchRides();
    } else {
      setState({ ...ridesCache, counts: countsCache });
    }
    return () => listeners.delete(setState);
  }, []);

  return { ...state, fetchRides };
}
