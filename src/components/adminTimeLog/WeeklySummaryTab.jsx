/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { Box, CircularProgress, Alert, Typography } from "@mui/material";
import { fetchWeeklySummary } from "../../hooks/firestore";

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
    return summary.map((item, i) => ({
      id: item.driver || i,
      driver: item.driver || "Unknown",
      trips: item.entries ?? 0,
      hours: (item.totalMinutes ?? 0) / 60,
    }));
  }, [summary]);

  const columns = [
    { field: "driver", headerName: "Driver", flex: 1, minWidth: 200 },
    { field: "trips", headerName: "Trips", width: 110, type: "number" },
    {
      field: "hours",
      headerName: "Hours",
      width: 120,
      type: "number",
      valueFormatter: (params = {}) => {
        const v = params?.value;
        return (typeof v === "number" ? v : 0).toFixed(2);
      },
    },
  ];

  if (err) return <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>;

  if (!summary) {
    return (
      <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={22} />
        <Typography variant="body2">Loading weekly summary…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Weekly Driver Summary
      </Typography>
      <DataGrid
        autoHeight
        rows={rows}
        columns={columns}
        density="compact"
        disableRowSelectionOnClick
        slots={{ toolbar: GridToolbar }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 300, placeholder: "Search" },
          },
        }}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[5, 10, 25]}
      />
    </Box>
  );
}
