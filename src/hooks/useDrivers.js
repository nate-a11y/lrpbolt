import { useState, useCallback } from "react";
import { fetchDrivers as apiFetchDrivers } from "./api";

export default function useDrivers() {
  const [drivers, setDrivers] = useState([]);

  const fetchDrivers = useCallback(async (userEmail = "") => {
    try {
      const data = await apiFetchDrivers();
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
