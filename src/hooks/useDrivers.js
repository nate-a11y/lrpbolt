import { useState, useCallback } from "react";
import { fetchUserAccess } from "./api";

export default function useDrivers() {
  const [drivers, setDrivers] = useState([]);

  const fetchDrivers = useCallback(async (userEmail = "") => {
    try {
      const data = (await fetchUserAccess(true)).map((d) => ({
        ...d,
        access: d.access?.toLowerCase() === "admin" ? "Admin" : "Driver",
      }));
      setDrivers(data);
      return (
        data.find(
          (d) => d.email?.toLowerCase() === userEmail.toLowerCase(),
        ) || null
      );
    } catch (err) {
      console.error("Failed to fetch drivers:", err);
      return null;
    }
  }, []);

  return { drivers, fetchDrivers };
}
