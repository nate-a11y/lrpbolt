/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Box, CircularProgress, Alert, Typography } from "@mui/material";
import { fetchWeeklySummary } from "../../hooks/firestore"; // adjust import

export default function WeeklySummaryTab() {
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchWeeklySummary()
      .then((data) => alive && setSummary(data))
      .catch((e) => setErr(e?.message || "Failed to load summary"));
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!summary) return [];
    return summary.map((item, index) => ({
      id: item.driverEmail || index,
      driverEmail: item.driverEmail || "",
      totalTrips: item.totalTrips || 0,
      totalPassengers: item.totalPassengers || 0,
      totalHours: item.totalHours || 0,
      vehicle: item.vehicle || "",
    }));
  }, [summary]);

  const columns = [
    { field: "driverEmail", headerName: "Driver", flex: 1 },
    { field: "vehicle", headerName: "Vehicle", width: 150 },
    { field: "totalTrips", headerName: "Trips", width: 110, type: "number" },
    { field: "totalPassengers", headerName: "Passengers", width: 140, type: "number" },
    {
      field: "totalHours",
      headerName: "Hours",
      width: 120,
      type: "number",
      valueFormatter: (p) => p.value?.toFixed(2) || "0.00",
    },
  ];

  if (err) return <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>;
  if (!summary) return <CircularProgress sx={{ m: 2 }} />;

  return (
    <Box sx={{ width: "100%", height: "auto" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Weekly Driver Summary
      </Typography>
      <DataGrid
        rows={rows}
        columns={columns}
        density="compact"
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
        }}
        pageSizeOptions={[5, 10, 25]}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}
