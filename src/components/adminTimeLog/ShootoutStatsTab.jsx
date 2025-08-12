/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState } from "react";
import { subscribeShootoutStats } from "../../hooks/firestore";

export default function ShootoutStatsTab() {
  const [stats, setStats] = useState([]);
  useEffect(() => {
    const unsub = subscribeShootoutStats(setStats);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);
  return <pre>{JSON.stringify(stats, null, 2)}</pre>;
}
