import { useCallback, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

import { db } from "src/utils/firebaseInit";

import { COLLECTIONS } from "../constants";
import { useAuth } from "../context/AuthContext.jsx";
import logError from "../utils/logError.js";
import { nullifyMissing } from "../utils/formatters.js";

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
      const list = snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        return { id: doc.id, ...nullifyMissing(data) };
      });
      setDrivers(list);
    } catch (err) {
      logError(err, "useDrivers");
    }
  }, [authLoading, user]);

  return { drivers, fetchDrivers };
}
