import React, { useEffect, useState } from "react";
import SafeDataGrid from "./_shared/SafeDataGrid.tsx";
import { fmtDateTime, minutesToHMM } from "../utils/timeUtils";
import { subscribeQueueRides } from "../hooks/api";

const columnsQueue = [
  { field: "rideId", headerName: "Ride ID", minWidth: 120, flex: 0.8, valueGetter: (p) => p.row?.rideId || p.row?.tripId || "" },
  { field: "vehicle", headerName: "Vehicle", minWidth: 140, flex: 0.9 },
  { field: "rideType", headerName: "Type", minWidth: 110 },
  { field: "pickupTime", headerName: "Pickup", minWidth: 180, flex: 1, valueFormatter: (p) => fmtDateTime(p.value) },
  { field: "durationMins", headerName: "Duration", minWidth: 110, valueFormatter: (p) => minutesToHMM(p.value) },
  { field: "notes", headerName: "Notes", flex: 1.2, minWidth: 160 },
];

export default function RideQueueGrid() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeQueueRides(setRows, console.error);
  }, []);

  return (
    <SafeDataGrid
      rows={rows}
      columns={columnsQueue}
      getRowId={(r) => r.id}
      autoHeight
    />
  );
}
