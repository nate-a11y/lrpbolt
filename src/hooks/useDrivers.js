import { useCallback, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

import { COLLECTIONS } from "../constants";
import { useAuth } from "../context/AuthContext.jsx";
import { db } from "src/utils/firebaseInit";
import { logError } from "../utils/logError";

export default function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const { user, authLoading } = useAuth();

  const fetchDrivers = useCallback(async () => {
    if (authLoading || !user) return;
    try {
      const q = query(
        collection(db, COLLECTIONS.USER_ACCESS),
        where("access", "==", "driver"),
        orderBy("name"),
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDrivers(list);
    } catch (err) {
      logError(err, "useDrivers");
    }
  }, [authLoading, user]);

  return { drivers, fetchDrivers };
}
