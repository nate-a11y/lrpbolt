/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import { buildNativeActionsColumn } from "../../columns/nativeActions.jsx";
import { db } from "../../utils/firebaseInit";
import { subscribeTimeLogs } from "../../hooks/firestore";
import { formatDateTime } from "../../utils/formatters.js";

export default function EntriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverFilter, setDriverFilter] = useState("");
  const [startFilter, setStartFilter] = useState(null);
  const [endFilter, setEndFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState(null);

  const handleEdit = useCallback((row) => {
    setEditRow(row);
  }, []);

  const handleEditSave = useCallback(async () => {
    try {
      await updateDoc(doc(db, "timeLogs", editRow.id), {
        driver: editRow.driverEmail,
      });
      setEditRow(null);
    } catch (e) {
      console.error(e);
      alert("Failed to update time log");
    }
  }, [editRow]);

    const handleDelete = useCallback(async (row) => {
      if (!window.confirm("Delete this time log?")) return;
      try {
        await deleteDoc(doc(db, "timeLogs", row.id));
      } catch (e) {
        console.error(e);
        alert("Failed to delete time log");
      }
    }, []);

  const actionsColumn = useMemo(
    () =>
      buildNativeActionsColumn({
        onEdit: (id, row) => handleEdit(row),
        onDelete: async (id, row) => await handleDelete(row),
      }),
    [handleEdit, handleDelete],
  );

    useEffect(() => {
      const unsub = subscribeTimeLogs(
        (logs) => {
          setRows(logs || []);
          setLoading(false);
        },
        (err) => {
          setError(err?.message || "Failed to load time logs.");
          setLoading(false);
        },
      );
      return () => typeof unsub === "function" && unsub();
    }, []);

    const filteredRows = useMemo(() => {
      return (rows || []).filter((r) => {
        const driverMatch = driverFilter
          ? (r.driverId ?? r.driverEmail)
              ?.toLowerCase()
              .includes(driverFilter.toLowerCase())
          : true;
        const startMatch = startFilter
          ? r.startTime?.getTime() >= startFilter.toDate().getTime()
          : true;
        const endMatch = endFilter
          ? (r.endTime ?? r.startTime)?.getTime() <=
            endFilter.toDate().getTime()
          : true;
        const searchMatch = search
          ? [
              r.driverId ?? r.driverEmail,
              r.rideId,
              formatDateTime(r.startTime),
              formatDateTime(r.endTime),
              formatDateTime(r.loggedAt),
              r.duration ?? r.minutes ?? Math.round((r.durationMs || 0) / 60000),
            ]
              .filter(Boolean)
              .some((v) =>
                String(v).toLowerCase().includes(search.toLowerCase()),
              )
          : true;
        return driverMatch && startMatch && endMatch && searchMatch;
      });
    }, [rows, driverFilter, startFilter, endFilter, search]);

  const safeRows = useMemo(
    () =>
      (filteredRows || [])
        .filter(Boolean)
        .map((r) => ({
          ...r,
          duration:
            r.duration ??
            r.minutes ??
            Math.round((r.durationMs || 0) / 60000),
        })),
    [filteredRows],
  );

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
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
        />
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
        <SmartAutoGrid
          rows={safeRows}
          headerMap={{
            driver: "Driver",
            driverEmail: "Driver Email",
            rideId: "Ride ID",
            startTime: "Clock In",
            endTime: "Clock Out",
            duration: "Duration",
            loggedAt: "Logged At",
            note: "Note",
          }}
          order={["driver","driverEmail","rideId","startTime","endTime","duration","loggedAt","note"]}
          actionsColumn={actionsColumn}
          loading={loading}
        />
      <Dialog open={!!editRow} onClose={() => setEditRow(null)}>
        <DialogTitle>Edit Driver</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Driver"
            value={editRow?.driverEmail || ""}
            onChange={(e) =>
              setEditRow((r) => ({ ...r, driverEmail: e.target.value }))
            }
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRow(null)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

