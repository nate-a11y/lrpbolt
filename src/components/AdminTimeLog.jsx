/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Paper, CircularProgress, Alert } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db } from "../firebase"; // adjust if different
import { isNil, tsToDate, fmtDateTime, diffMinutes } from "../utils/timeUtilsSafe";

export default function AdminTimeLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Adjust collection path as needed
    try {
      const qRef = query(collection(db, "timeLogs"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        qRef,
        (snap) => {
          const data = [];
          snap.forEach((doc) => {
            const d = doc.data() || {};
            // Normalize shapes; NEVER store nested {value:...} in the grid
            data.push({
              id: doc.id,
              driverEmail: typeof d.driverEmail === "string" ? d.driverEmail : d?.driverEmail?.value ?? null,
              vehicle: typeof d.vehicle === "string" ? d.vehicle : d?.vehicle?.value ?? null,
              startTime: d.startTime ?? null,
              endTime: d.endTime ?? null,
              trips: isNil(d.trips) ? null : d.trips,
              passengers: isNil(d.passengers) ? null : d.passengers,
              createdAt: d.createdAt ?? null,
            });
          });
          setRows(data);
          setLoading(false);
        },
        (err) => {
          setError(err?.message || "Failed to load time logs.");
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      setError(e?.message || "Failed to subscribe to time logs.");
      setLoading(false);
    }
  }, []);

  const columns = useMemo(() => {
    return [
      {
        field: "driverEmail",
        headerName: "Driver",
        flex: 1,
        minWidth: 160,
        valueGetter: (params) => params.row?.driverEmail ?? null,
        valueFormatter: ({ value }) => (isNil(value) || value === "" ? "—" : value),
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        flex: 1,
        minWidth: 140,
        valueGetter: (params) => params.row?.vehicle ?? null,
        valueFormatter: ({ value }) => (isNil(value) || value === "" ? "—" : value),
      },
      {
        field: "startTime",
        headerName: "Start",
        type: "dateTime",
        flex: 1,
        minWidth: 190,
        valueGetter: (params) => params.row?.startTime ?? null,
        valueFormatter: ({ value }) => fmtDateTime(value),
        sortComparator: (a, b) => {
          const da = tsToDate(a)?.getTime() ?? -1;
          const dbv = tsToDate(b)?.getTime() ?? -1;
          return da - dbv;
        },
      },
      {
        field: "endTime",
        headerName: "End",
        type: "dateTime",
        flex: 1,
        minWidth: 190,
        valueGetter: (params) => params.row?.endTime ?? null,
        valueFormatter: ({ value }) => fmtDateTime(value),
        sortComparator: (a, b) => {
          const da = tsToDate(a)?.getTime() ?? -1;
          const dbv = tsToDate(b)?.getTime() ?? -1;
          return da - dbv;
        },
      },
      {
        field: "durationMin",
        headerName: "Duration",
        description: "Computed from Start → End",
        flex: 0.7,
        minWidth: 120,
        // Store as number for native numeric sort, but display pretty
        valueGetter: (params) => {
          const m = diffMinutes(params.row?.startTime, params.row?.endTime);
          return isNil(m) ? null : m; // number or null
        },
        valueFormatter: ({ value }) => (isNil(value) ? "—" : `${value} min`),
        sortComparator: (a, b) => {
          const na = isNil(a) ? -1 : Number(a);
          const nb = isNil(b) ? -1 : Number(b);
          return na - nb;
        },
      },
      {
        field: "trips",
        headerName: "Trips",
        type: "number",
        flex: 0.5,
        minWidth: 90,
        valueGetter: (params) => (isNil(params.row?.trips) ? null : Number(params.row.trips)),
        valueFormatter: ({ value }) => (isNil(value) ? "—" : String(value)),
      },
      {
        field: "passengers",
        headerName: "Pax",
        type: "number",
        flex: 0.5,
        minWidth: 90,
        valueGetter: (params) => (isNil(params.row?.passengers) ? null : Number(params.row.passengers)),
        valueFormatter: ({ value }) => (isNil(value) ? "—" : String(value)),
      },
      {
        field: "createdAt",
        headerName: "Created",
        type: "dateTime",
        flex: 1,
        minWidth: 190,
        valueGetter: (params) => params.row?.createdAt ?? null,
        valueFormatter: ({ value }) => fmtDateTime(value),
        sortComparator: (a, b) => {
          const da = tsToDate(a)?.getTime() ?? -1;
          const dbv = tsToDate(b)?.getTime() ?? -1;
          return da - dbv;
        },
      },
    ];
  }, []);

  if (loading) {
    return (
      <Box p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 1 }}>
      <div style={{ height: 640, width: "100%" }}>
        <DataGrid
          rows={rows}
          getRowId={(r) => r.id}
          columns={columns}
          disableRowSelectionOnClick
          initialState={{
            sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
            columns: {
              columnVisibilityModel: {
                createdAt: true,
              },
            },
          }}
        />
      </div>
    </Paper>
  );
}
