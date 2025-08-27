import { useEffect, useState } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";

import { db } from "../utils/firebaseInit";
import { COLLECTIONS } from "../constants";
import { useAuth } from "../context/AuthContext.jsx";
import { subscribeFirestore } from "../utils/listenerRegistry";
import { nullifyMissing } from "../utils/formatters.js";

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
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;
    const key = getKey({ activeOnly, roles, max });
    const constraints = [orderBy("name", "asc"), limit(max)];
    if (activeOnly) constraints.push(where("active", "==", true));
    if (roles) constraints.push(where("access", "in", roles));
    const q = query(collection(db, COLLECTIONS.USER_ACCESS), ...constraints);

    return subscribeFirestore(key, q, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        return { id: doc.id, ...nullifyMissing(data) };
      });
      setData(list);
    });
  }, [authLoading, user, activeOnly, roles, max]);

  return data;
}
