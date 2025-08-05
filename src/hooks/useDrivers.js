import { useState, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function useDrivers() {
  const [drivers, setDrivers] = useState([]);

  const fetchDrivers = useCallback(async (userEmail = "") => {
    try {
      const snapshot = await getDocs(collection(db, "driverRotation"));
      const data = snapshot.docs.map(doc => doc.data());

      const names = data.map((d) => d.name);
      setDrivers(names);

      const match = data.find(
        (d) => d.email?.toLowerCase() === userEmail.toLowerCase()
      );
      return match?.name || userEmail || "";
    } catch (err) {
      console.error("Failed to fetch drivers:", err);
      return userEmail || "";
    }
  }, []);

  return { drivers, fetchDrivers };
}
