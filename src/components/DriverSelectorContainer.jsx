/* Proprietary and confidential. See LICENSE. */
// src/components/DriverSelectorContainer.jsx
import React, { useState } from "react";
import DriverSelector from "./DriverSelector";
import { useUserAccessDrivers } from "../hooks/useUserAccessDrivers";

export default function DriverSelectorContainer({ role, isTracking = false }) {
  const { drivers, loading } = useUserAccessDrivers(["admin", "driver"]);
  const [driver, setDriver] = useState(null);

  // Pass through as objects { id, name, email }
  return (
    <DriverSelector
      role={role}
      isTracking={isTracking}
      driver={driver}
      setDriver={setDriver}
      drivers={drivers}
      loading={loading}
    />
  );
}
