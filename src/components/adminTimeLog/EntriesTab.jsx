/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Paper,
  CircularProgress,
  Alert,
  Stack,
  Typography,
  useMediaQuery,
  TextField,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import {
  onSnapshot,
  collection,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../utils/firebaseInit"; // adjust if needed
import { isNil, tsToDate, fmtDateTime } from "../../utils/timeUtilsSafe";
import { normalizeTimeLog } from "../../utils/normalizeTimeLog";
import ToolsCell from "./cells/ToolsCell.jsx";

export default function EntriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));
  const [driverFilter, setDriverFilter] = useState("");
  const [startFilter, setStartFilter] = useState(null);
  const [endFilter, setEndFilter] = useState(null);
  const handleEdit = useCallback(async (row) => {
    const newDriver = window.prompt("Driver", row?.driverDisplay || "");
    if (!newDriver) return;
    try {
      await updateDoc(doc(db, "timeLogs", row.id), { driver: newDriver });
    } catch (e) {
      alert("Failed to update time log");
    }
  }, []);

  const handleDelete = useCallback(async (row) => {
    if (!window.confirm("Delete this time log?")) return;
    try {
      await deleteDoc(doc(db, "timeLogs", row.id));
    } catch (e) {
      alert("Failed to delete time log");
    }
  }, []);

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

  const columns = useMemo(
    () => [
      {
        field: "driver",
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
        field: "duration",
        headerName: "Duration",
        description: "Minutes",
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
        field: "loggedAt",
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

  const filteredRows = useMemo(() => {
    return (rows || []).filter((r) => {
      const driverMatch = driverFilter
        ? r.driverDisplay?.toLowerCase().includes(driverFilter.toLowerCase())
        : true;
      const startMatch = startFilter
        ? tsToDate(r.startTime)?.getTime() >= startFilter.toDate().getTime()
        : true;
      const endMatch = endFilter
        ? tsToDate(r.endTime ?? r.startTime)?.getTime() <=
          endFilter.toDate().getTime()
        : true;
      return driverMatch && startMatch && endMatch;
    });
  }, [rows, driverFilter, startFilter, endFilter]);

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
      <Box
        sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}
      >
        <TextField
          label="Driver"
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          size="small"
        />
        <DatePicker
          label="Start after"
          value={startFilter}
          onChange={(v) => setStartFilter(v)}
          slotProps={{ textField: { size: "small" } }}
        />
        <DatePicker
          label="End before"
          value={endFilter}
          onChange={(v) => setEndFilter(v)}
          slotProps={{ textField: { size: "small" } }}
        />
      </Box>
      {isSmall ? (
        <Stack spacing={2}>
          {(filteredRows ?? []).map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{r.driverDisplay}</Typography>
                  <Typography variant="body2">Ride ID: {r.rideId ?? "—"}</Typography>
                  <Typography variant="body2">Start: {fmtDateTime(r.startTime)}</Typography>
                  <Typography variant="body2">End: {fmtDateTime(r.endTime)}</Typography>
                  <Typography variant="body2">
                    Duration: {isNil(r.durationMin) ? "—" : `${r.durationMin} min`}
                  </Typography>
                  <Typography variant="body2">Logged: {fmtDateTime(r.createdAt)}</Typography>
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
        <div style={{ height: 640, width: "100%" }}>
          <DataGrid
            rows={filteredRows ?? []}
            getRowId={(r) => r?.id ?? String(Math.random())}
            columns={columns}
            disableRowSelectionOnClick
            initialState={{
              sorting: { sortModel: [{ field: "loggedAt", sort: "desc" }] },
              columns: { columnVisibilityModel: { loggedAt: false } },
            }}
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 300, placeholder: "Search" },
              },
            }}
          />
        </div>
      )}
    </Paper>
  );
}

