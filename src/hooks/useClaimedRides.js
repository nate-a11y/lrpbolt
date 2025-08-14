import { useEffect, useState } from "react";

import { subscribeRides } from "../services/firestoreService";
import { COLLECTIONS } from "../constants";

export default function useClaimedRides() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    const unsub = subscribeRides(COLLECTIONS.CLAIMED_RIDES, setRides);
    return () => unsub();
  }, []);

  return rides;
}
