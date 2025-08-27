import React, { useEffect, useState } from "react";

import { subscribeQueueRides } from "../hooks/api";

import SafeDataGrid from "./_shared/SafeDataGrid.tsx";
import { rideColumns } from "./rides/rideColumns.js";

export default function RideQueueGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeQueueRides(setRows, console.error);
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
