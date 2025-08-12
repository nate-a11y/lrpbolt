import { useEffect, useState } from "react";

import { subscribeLiveRides } from "./api";

export default function useLiveRides() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    const unsub = subscribeLiveRides(setRides);
    return () => unsub();
  }, []);

  return rides;
}
