/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import {
  Box,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { subscribeShootoutStats } from "../../hooks/firestore";
import { tsToDate, fmtDateTime } from "../../utils/timeUtilsSafe";
import ToolsCell from "./cells/ToolsCell.jsx";

export default function ShootoutStatsTab() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));

  const handleEdit = useCallback((row) => {
    console.log("edit", row);
  }, []);

  const handleDelete = useCallback((row) => {
    console.log("delete", row);
  }, []);

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      (rows) => setStats(rows || []),
      (e) => setErr(e?.message || "Failed to load"),
    );
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

  const columns = useMemo(
    () => [
      { field: "driverEmail", headerName: "Driver", flex: 1 },
      { field: "vehicle", headerName: "Vehicle", width: 120 },
      { field: "trips", headerName: "Trips", width: 90, type: "number" },
      { field: "passengers", headerName: "Pax", width: 90, type: "number" },
      {
        field: "startTime",
        headerName: "Start",
        flex: 1,
        minWidth: 170,
        valueGetter: (params = {}) => params?.row?.startTime ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
      },
      {
        field: "endTime",
        headerName: "End",
        flex: 1,
        minWidth: 170,
        valueGetter: (params = {}) => params?.row?.endTime ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
      },
      {
        field: "createdAt",
        headerName: "Created",
        flex: 1,
        minWidth: 170,
        valueGetter: (params = {}) => params?.row?.createdAt ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
      },
      {
        field: "tools",
        headerName: "",
        width: 80,
        sortable: false,
        renderCell: (params = {}) => (
          <ToolsCell
            row={params?.row}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ),
      },
    ],
    [handleEdit, handleDelete]
  );

  if (err) return <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>;
  if (!stats) return <CircularProgress sx={{ m: 2 }} />;

  return (
    <Box sx={{ width: "100%" }}>
      {isSmall ? (
        <Stack spacing={2}>
          {rows.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{r.driverEmail}</Typography>
                  <Typography variant="body2">Vehicle: {r.vehicle}</Typography>
                  <Typography variant="body2">Trips: {r.trips}</Typography>
                  <Typography variant="body2">Passengers: {r.passengers}</Typography>
                  <Typography variant="body2">Start: {fmtDateTime(r.startTime)}</Typography>
                  <Typography variant="body2">End: {fmtDateTime(r.endTime)}</Typography>
                  <Typography variant="body2">Created: {fmtDateTime(r.createdAt)}</Typography>
                </Stack>
                <ToolsCell
                  row={r}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </Box>
            </Paper>
          ))}
        </Stack>
      ) : (
        <DataGrid
          rows={rows}
          columns={columns}
          density="compact"
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[5, 10, 25]}
          disableRowSelectionOnClick
          autoHeight
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300, placeholder: "Search" },
            },
          }}
        />
      )}
    </Box>
  );
}
