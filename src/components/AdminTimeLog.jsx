/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Paper, CircularProgress, Alert } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db } from "../firebase"; // adjust if your firebase export path differs
import { isNil, tsToDate, fmtDateTime, diffMinutes } from "../utils/timeUtilsSafe";

export default function AdminTimeLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      // ✅ Change "timeLogs" if your collection is named differently
      const qRef = query(collection(db, "timeLogs"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        qRef,
        (snap) => {
          const data = [];
          snap.forEach((doc) => {
            const d = doc.data() || {};
            data.push({
              id: doc.id,
              driverEmail: typeof d.driverEmail === "string" ? d.driverEmail : d?.driverEmail?.value ?? null,
              vehicle: typeof d.vehicle === "string" ? d.vehicle : d?.vehicle?.value ?? null,
              startTime: d.startTime ?? null,
              endTime: d.endTime ?? null,
              trips: isNil(d.trips) ? null : Number(d.trips),
              passengers: isNil(d.passengers) ? null : Number(d.passengers),
              createdAt: d.createdAt ?? null,
            });
          });
          setRows(Array.isArray(data) ? data : []);
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
    // NOTE: Never destructure params; always guard: (params = {}) => ...
    return [
      {
        field: "driverEmail",
        headerName: "Driver",
        flex: 1,
        minWidth: 160,
        valueGetter: (params = {}) => params?.row?.driverEmail ?? null,
        valueFormatter: (params = {}) => {
          const v = params?.value;
          return isNil(v) || v === "" ? "—" : String(v);
        },
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        flex: 1,
        minWidth: 140,
        valueGetter: (params = {}) => params?.row?.vehicle ?? null,
        valueFormatter: (params = {}) => {
          const v = params?.value;
          return isNil(v) || v === "" ? "—" : String(v);
        },
      },
      {
        field: "startTime",
        headerName: "Start",
        type: "dateTime",
        flex: 1,
        minWidth: 190,
        valueGetter: (params = {}) => params?.row?.startTime ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
        sortComparator: (a, b) => {
          const da = tsToDate(a)?.getTime() ?? -1;
          const db = tsToDate(b)?.getTime() ?? -1;
          return da - db;
        },
      },
      {
        field: "endTime",
        headerName: "End",
        type: "dateTime",
        flex: 1,
        minWidth: 190,
        valueGetter: (params = {}) => params?.row?.endTime ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
        sortComparator: (a, b) => {
          const da = tsToDate(a)?.getTime() ?? -1;
          const db = tsToDate(b)?.getTime() ?? -1;
          return da - db;
        },
      },
      {
        field: "durationMin",
        headerName: "Duration",
        description: "Computed from Start → End (minutes)",
        flex: 0.7,
        minWidth: 120,
        // Compute directly from row to avoid nested {s,e} objects
        valueGetter: (params = {}) => {
          const r = params?.row ?? null;
          const m = diffMinutes(r?.startTime, r?.endTime);
          return isNil(m) ? null : m; // number (better sorting)
        },
        valueFormatter: (params = {}) => {
          const v = params?.value;
          return isNil(v) ? "—" : `${v} min`;
        },
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
        valueGetter: (params = {}) => {
          const v = params?.row?.trips;
          return isNil(v) ? null : Number(v);
        },
        valueFormatter: (params = {}) => {
          const v = params?.value;
          return isNil(v) ? "—" : String(v);
        },
      },
      {
        field: "passengers",
        headerName: "Pax",
        type: "number",
        flex: 0.5,
        minWidth: 90,
        valueGetter: (params = {}) => {
          const v = params?.row?.passengers;
          return isNil(v) ? null : Number(v);
        },
        valueFormatter: (params = {}) => {
          const v = params?.value;
          return isNil(v) ? "—" : String(v);
        },
      },
      {
        field: "createdAt",
        headerName: "Created",
        type: "dateTime",
        flex: 1,
        minWidth: 190,
        valueGetter: (params = {}) => params?.row?.createdAt ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
        sortComparator: (a, b) => {
          const da = tsToDate(a)?.getTime() ?? -1;
          const db = tsToDate(b)?.getTime() ?? -1;
          return da - db;
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
          rows={rows ?? []}                // ✅ never pass undefined
          getRowId={(r) => r?.id ?? String(Math.random())}
          columns={columns}
          disableRowSelectionOnClick
          initialState={{
            sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
          }}
        />
      </div>
    </Paper>
  );
}

