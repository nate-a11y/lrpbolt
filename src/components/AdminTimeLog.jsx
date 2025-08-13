/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Paper, CircularProgress, Alert } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db } from "src/utils/firebaseInit"; // adjust if needed
import { isNil, tsToDate, fmtDateTime } from "../utils/timeUtilsSafe";
import { normalizeTimeLog } from "../utils/normalizeTimeLog";

export default function AdminTimeLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      // 🔁 Change "timeLogs" if your collection name differs.
      const qRef = query(collection(db, "timeLogs"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        qRef,
        (snap) => {
          const data = [];
          snap.forEach((doc) => data.push(normalizeTimeLog(doc.id, doc.data() || {})));
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

  const columns = useMemo(() => [
    {
      field: "driverDisplay",
      headerName: "Driver",
      flex: 1,
      minWidth: 160,
      valueGetter: (params = {}) => params?.row?.driverDisplay ?? null,
      valueFormatter: (params = {}) => {
        const v = params?.value;
        return isNil(v) || v === "" ? "—" : String(v);
      },
    },
    {
      field: "rideId",
      headerName: "Ride ID",
      flex: 0.8,
      minWidth: 110,
      valueGetter: (params = {}) => params?.row?.rideId ?? null,
      valueFormatter: (params = {}) => {
        const v = params?.value;
        return isNil(v) || v === "" ? "—" : String(v);
      },
    },
    {
      field: "mode",
      headerName: "Mode",
      flex: 0.8,
      minWidth: 100,
      valueGetter: (params = {}) => params?.row?.mode ?? null,
      valueFormatter: (params = {}) => (isNil(params?.value) ? "—" : String(params.value)),
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
      description: "Stored or computed (minutes)",
      flex: 0.7,
      minWidth: 120,
      valueGetter: (params = {}) => {
        const v = params?.row?.durationMin;
        return isNil(v) ? null : Number(v);
      },
      valueFormatter: (params = {}) => (isNil(params?.value) ? "—" : `${params.value} min`),
      sortComparator: (a, b) => {
        const na = isNil(a) ? -1 : Number(a);
        const nb = isNil(b) ? -1 : Number(b);
        return na - nb;
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.7,
      minWidth: 110,
      valueGetter: (params = {}) => params?.row?.status ?? null,
      valueFormatter: (params = {}) => (isNil(params?.value) ? "—" : String(params.value)),
    },
    {
      field: "createdAt",
      headerName: "Logged",
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
  ], []);

  if (loading) {
    return (<Box p={2}><CircularProgress size={24} /></Box>);
  }
  if (error) {
    return (<Box p={2}><Alert severity="error">{error}</Alert></Box>);
  }

  return (
    <Paper sx={{ p: 1 }}>
      <div style={{ height: 640, width: "100%" }}>
        <DataGrid
          rows={rows ?? []}
          getRowId={(r) => r?.id ?? String(Math.random())}
          columns={columns}
          disableRowSelectionOnClick
          initialState={{
            sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
            columns: { columnVisibilityModel: { createdAt: false } },
          }}
        />
      </div>
    </Paper>
  );
}
