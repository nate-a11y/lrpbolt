import { useEffect, useState } from "react";
import { subscribeRideQueue } from "./api";

export default function useRideQueue() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    const unsub = subscribeRideQueue(setRides);
    return () => unsub();
  }, []);

  return rides;
}
