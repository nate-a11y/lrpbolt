import { useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";

import { subscribeRideQueue } from "./api";

export default function useRideQueue() {
  const [rides, setRides] = useState([]);
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user?.email) return;
    const unsub = subscribeRideQueue(setRides, undefined, () => {});
    return () => unsub();
  }, [authLoading, user?.email]);

  return rides;
}
