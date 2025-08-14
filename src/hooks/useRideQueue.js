import { useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";
import { subscribeRides } from "../services/firestoreService";
import { COLLECTIONS } from "../constants";

export default function useRideQueue() {
  const [rides, setRides] = useState([]);
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user?.email) return;
    const unsub = subscribeRides(COLLECTIONS.RIDE_QUEUE, setRides, () => {});
    return () => unsub();
  }, [authLoading, user?.email]);

  return rides;
}
