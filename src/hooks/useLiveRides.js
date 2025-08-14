import { useEffect, useState } from "react";

import { subscribeRides } from "../services/firestoreService";
import { COLLECTIONS } from "../constants";

export default function useLiveRides() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    const unsub = subscribeRides(COLLECTIONS.LIVE_RIDES, setRides);
    return () => unsub();
  }, []);

  return rides;
}
