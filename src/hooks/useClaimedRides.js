import { useEffect, useState } from "react";

import { subscribeClaimedRides } from "./api";

export default function useClaimedRides() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    const unsub = subscribeClaimedRides(setRides);
    return () => unsub();
  }, []);

  return rides;
}
