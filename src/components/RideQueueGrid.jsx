import React, { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid-pro";
import { rideColumns } from "./rides/rideColumns";
import { subscribeQueueRides } from "../hooks/api";

export default function RideQueueGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeQueueRides(setRows, console.error);
  }, []);

  return (
    <DataGrid
      rows={rows}
      columns={rideColumns}
      getRowId={(r) => r.id}
      density="comfortable"
      disableRowSelectionOnClick
      autoHeight
    />
  );
}
