import React, { useEffect, useState } from "react";
import SafeDataGrid from "./_shared/SafeDataGrid.tsx";
import { subscribeLiveRides } from "../hooks/api";
import { rideColumns } from "./rides/rideColumns.js";

export default function LiveRidesGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeLiveRides(setRows, console.error);
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
