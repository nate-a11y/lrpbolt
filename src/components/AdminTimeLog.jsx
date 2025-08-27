import React, { useEffect, useState } from "react";
import PageContainer from "./PageContainer.jsx";
import SafeDataGrid from "./_shared/SafeDataGrid.tsx";
import { fmtDateTime, minutesToHMM } from "../utils/timeUtils";
import { subscribeTimeLogs } from "../hooks/api";

const columnsTimeLogs = [
  { field: "driver", headerName: "Driver", flex: 1, minWidth: 120, valueGetter: (p) => p.row?.driver || p.row?.driverId || "" },
  { field: "rideId", headerName: "Ride ID", flex: 0.7, minWidth: 120, valueGetter: (p) => p.row?.rideId || p.row?.tripId || "" },
  { field: "start", headerName: "Start", flex: 1, minWidth: 180, valueFormatter: (p) => fmtDateTime(p.value) },
  { field: "end", headerName: "End", flex: 1, minWidth: 180, valueFormatter: (p) => fmtDateTime(p.value) },
  { field: "durationMins", headerName: "Duration", flex: 0.8, minWidth: 120, valueFormatter: (p) => minutesToHMM(p.value) },
  { field: "created", headerName: "Logged At", flex: 1, minWidth: 180, valueFormatter: (p) => fmtDateTime(p.value) },
];

export default function AdminTimeLog() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    return subscribeTimeLogs(setRows, console.error);
  }, []);

  return (
    <PageContainer title="Admin Logs">
      <SafeDataGrid
        rows={rows}
        columns={columnsTimeLogs}
        getRowId={(r) => r.id}
        autoHeight
      />
    </PageContainer>
  );
}
