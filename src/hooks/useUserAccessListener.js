import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

// In-memory cache to share a single Firestore listener across components.
const cache = new Map();

function getKey({ activeOnly, roles, max }) {
  return JSON.stringify({ activeOnly, roles, max });
}

/**
 * Subscribe to the userAccess collection while preventing duplicate network
 * listeners. Multiple components using this hook with the same options will
 * share one Firestore onSnapshot listener.
 */
export default function useUserAccessListener(
  { activeOnly = false, roles = ["admin", "driver"], max = 100 } = {},
) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const key = getKey({ activeOnly, roles, max });
    const callback = (d) => setData(d);
    let entry = cache.get(key);

    if (entry) {
      entry.callbacks.push(callback);
      if (entry.data) callback(entry.data);
    } else {
      const constraints = [orderBy("name", "asc"), limit(max)];
      if (activeOnly) constraints.push(where("active", "==", true));
      if (roles) constraints.push(where("access", "in", roles));
      const q = query(collection(db, "userAccess"), ...constraints);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const current = cache.get(key);
        if (current) {
          current.data = list;
          current.callbacks.forEach((cb) => cb(list));
        }
      });
      entry = { unsubscribe, callbacks: [callback], data: null };
      cache.set(key, entry);
    }

    return () => {
      const current = cache.get(key);
      if (!current) return;
      current.callbacks = current.callbacks.filter((cb) => cb !== callback);
      if (current.callbacks.length === 0) {
        current.unsubscribe();
        cache.delete(key);
      }
    };
  }, [activeOnly, roles, max]);

  return data;
}
