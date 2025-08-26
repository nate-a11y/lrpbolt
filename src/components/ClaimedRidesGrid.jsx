import React, { useEffect, useState } from "react";
import { DataGrid } from "@mui/x-data-grid-pro";
import { rideColumns } from "./rides/LiveQueueClaimedColumns";
import { subscribeClaimedRides } from "../hooks/api";

export default function ClaimedRidesGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeClaimedRides(setRows, console.error);
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
