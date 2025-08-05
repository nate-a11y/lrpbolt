/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

let ridesCache = {
  rideQueue: [],
  liveRides: [],
  claimedRides: [],
};
let countsCache = { queue: 0, live: 0, claimed: 0 };
const listeners = new Set();
let initialized = false;

export async function fetchRides() {
  const [queueSnap, liveSnap, claimedSnap] = await Promise.all([
    getDocs(query(collection(db, "rideQueue"), orderBy("pickupTime", "asc"))),
    getDocs(query(collection(db, "liveRides"), orderBy("pickupTime", "asc"))),
    getDocs(query(collection(db, "claimedRides"), orderBy("pickupTime", "asc"))),
  ]);

  ridesCache = {
    rideQueue: queueSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    liveRides: liveSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    claimedRides: claimedSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
  countsCache = {
    queue: ridesCache.rideQueue.length,
    live: ridesCache.liveRides.length,
    claimed: ridesCache.claimedRides.length,
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
