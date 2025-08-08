import { useState, useCallback } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { logError } from "../utils/logError";
import { COLLECTIONS } from "../constants";

export default function useDrivers() {
  const [drivers, setDrivers] = useState([]);

  const fetchDrivers = useCallback(async () => {
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
  }, []);

  return { drivers, fetchDrivers };
}
