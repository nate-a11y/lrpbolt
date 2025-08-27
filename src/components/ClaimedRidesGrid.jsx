import React, { useEffect, useState } from "react";
import SafeDataGrid from "./_shared/SafeDataGrid.tsx";
import { subscribeClaimedRides } from "../hooks/api";
import { rideColumns } from "./rides/rideColumns.js";

export default function ClaimedRidesGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeClaimedRides(setRows, console.error);
  }, []);

  return (
    <SafeDataGrid
      rows={rows}
      columns={rideColumns}
      getRowId={(r) => r.id}
      autoHeight
    />
  );
}
