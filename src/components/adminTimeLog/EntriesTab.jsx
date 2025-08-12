/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { subscribeTimeLogs } from "../../hooks/firestore";
import ToolsCell from "./cells/ToolsCell.jsx";
import StatusCell from "./cells/StatusCell.jsx";

/** Safely turn a Firestore Timestamp/seconds/ms into a JS Date */
function tsToDate(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "number") return new Date(v);
  return null;
}

/** Compute minutes between two timestamps (rounded) */
function minutesBetween(start, end) {
  const s = tsToDate(start);
  const e = tsToDate(end);
  if (!s || !e) return 0;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
}

export default function EntriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeTimeLogs((data) => {
      const mapped = (data || []).map((snap, i) => {
        // Support either DocumentSnapshot[] or plain objects[]
        const d = typeof snap?.data === "function" ? snap.data() : snap || {};
        const id =
          snap?.id ||
          d.id ||
          `${d.userEmail || d.driver || "row"}-${d.startTime?.seconds ?? i}`;

        const startTime = d.startTime ?? null;
        const endTime = d.endTime ?? null;
        const duration =
          typeof d.duration === "number" && d.duration > 0
            ? Math.round(d.duration)
            : minutesBetween(startTime, endTime);

        const driver = d.driverEmail || d.driver || "";
        const status = endTime ? "Closed" : "Open";

        return {
          id,
          driver,
          rideId: d.rideId || "",
          mode: d.mode || "RIDE",
          startTime,
          endTime,
          duration,
          note: d.note || "",
          status,
          createdAt: d.createdAt || null,
          updatedAt: d.updatedAt || null,
        };
      });

      setRows(mapped);
      setLoading(false);
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const columns = useMemo(
    () => [
      { field: "driver", headerName: "Driver", flex: 1, minWidth: 160 },
      { field: "rideId", headerName: "Ride ID", width: 120 },
      { field: "mode", headerName: "Mode", width: 110 },
      {
        field: "startTime",
        headerName: "Start",
        width: 180,
        valueGetter: (p) => tsToDate(p.row.startTime),
        valueFormatter: (p) => (p.value ? dayjs(p.value).format("M/D/YYYY h:mm A") : "—"),
      },
      {
        field: "endTime",
        headerName: "End",
        width: 180,
        valueGetter: (p) => tsToDate(p.row.endTime),
        valueFormatter: (p) => (p.value ? dayjs(p.value).format("M/D/YYYY h:mm A") : "—"),
      },
      {
        field: "duration",
        headerName: "Duration (min)",
        type: "number",
        width: 140,
        valueGetter: (p) => p.row.duration ?? 0,
      },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        renderCell: (params) => <StatusCell value={params.value} />,
        sortable: true,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => <ToolsCell row={params.row} />,
      },
    ],
    []
  );

  return (
    <Stack spacing={2}>
      <Box sx={{ width: "100%" }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Time Log Entries
        </Typography>
        <DataGrid
          autoHeight
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          density="compact"
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
          }}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            columns: {
              columnVisibilityModel: {
                note: false,
                createdAt: false,
                updatedAt: false,
              },
            },
          }}
          pageSizeOptions={[5, 10, 25, 50]}
        />
      </Box>
    </Stack>
  );
}
