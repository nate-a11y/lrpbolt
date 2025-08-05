import { useEffect, useState } from "react";
import { subscribeClaimedRides } from "./api";

let cache = [];
let unsubscribeFn = null;
const listeners = new Set();

export default function useClaimedRides() {
  const [rides, setRides] = useState(cache);

  useEffect(() => {
    listeners.add(setRides);
    if (!unsubscribeFn) {
      unsubscribeFn = subscribeClaimedRides((data) => {
        cache = data;
        listeners.forEach((cb) => cb(cache));
      });
    } else {
      setRides(cache);
    }
    return () => {
      listeners.delete(setRides);
      if (listeners.size === 0 && unsubscribeFn) {
        unsubscribeFn();
        unsubscribeFn = null;
      }
    };
  }, []);

  return rides;
}
