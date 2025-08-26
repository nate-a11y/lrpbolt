/* Proprietary and confidential. See LICENSE. */
// src/components/DriverSelectorContainer.jsx
import { useState } from "react";

import { useUserAccessDrivers } from "../hooks/useUserAccessDrivers";

import DriverSelector from "./DriverSelector";

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
