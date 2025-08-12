/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { Box, CircularProgress, Alert } from "@mui/material";
import { subscribeShootoutStats } from "../../hooks/firestore";

// Firestore Timestamp -> JS Date (or null)
const tsToDate = (ts) => {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  // fallback if already serialized
  if (ts.seconds != null) return new Date(ts.seconds * 1000);
  return null;
};

export default function ShootoutStatsTab() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const unsub = subscribeShootoutStats({
      onData: (rows) => setStats(rows || []),
      onError: (e) => setErr(e?.message || "Failed to load"),
    });
    return () => typeof unsub === "function" && unsub();
  }, []);

  const rows = useMemo(
    () =>
      (stats || []).map((r, i) => ({
        id: r.id || i,
        driverEmail: r.driverEmail || "",
        vehicle: r.vehicle || "",
        trips: Number(r.trips || 0),
        passengers: Number(r.passengers || 0),
        startTime: tsToDate(r.startTime),
        endTime: tsToDate(r.endTime),
        createdAt: tsToDate(r.createdAt),
      })),
    [stats]
  );

  const columns = [
    { field: "driverEmail", headerName: "Driver", flex: 1 },
    { field: "vehicle", headerName: "Vehicle", width: 120 },
    { field: "trips", headerName: "Trips", width: 90, type: "number" },
    { field: "passengers", headerName: "Pax", width: 90, type: "number" },
    {
      field: "startTime",
      headerName: "Start",
      width: 170,
      valueGetter: (p) => p.row.startTime,
      valueFormatter: (p) => (p.value ? p.value.toLocaleString() : "—"),
    },
    {
      field: "endTime",
      headerName: "End",
      width: 170,
      valueGetter: (p) => p.row.endTime,
      valueFormatter: (p) => (p.value ? p.value.toLocaleString() : "—"),
    },
    {
      field: "createdAt",
      headerName: "Created",
      width: 170,
      valueGetter: (p) => p.row.createdAt,
      valueFormatter: (p) => (p.value ? p.value.toLocaleString() : "—"),
    },
  ];

  if (err) return <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>;
  if (!stats) return <CircularProgress sx={{ m: 2 }} />;

  return (
    <Box sx={{ height: 520, width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        density="compact"
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[5, 10, 25]}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}
