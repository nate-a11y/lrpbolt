import { useState, useCallback } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { logError } from "../utils/errorUtils";

export default function useDrivers() {
  const [drivers, setDrivers] = useState([]);

  const fetchDrivers = useCallback(async () => {
    try {
      const q = query(
        collection(db, "userAccess"),
        where("access", "==", "driver"),
        orderBy("name"),
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDrivers(list);
    } catch (err) {
      logError(err, "Failed to fetch drivers");
    }
  }, []);

  return { drivers, fetchDrivers };
}
