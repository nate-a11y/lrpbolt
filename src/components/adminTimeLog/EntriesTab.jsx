/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Paper,
  CircularProgress,
  Alert,
  Stack,
  Typography,
  useMediaQuery,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";
import { DataGridPro, GridToolbar, useGridApiRef } from "@mui/x-data-grid-pro";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";

import { fmtDateTime, fmtText, fmtMinutes } from "@/utils/timeUtils";
import actionsCol from "../grid/actionsCol.jsx";
import { db } from "../../utils/firebaseInit";
import { subscribeTimeLogs } from "../../hooks/firestore";

import ToolsCell from "./cells/ToolsCell.jsx";

export default function EntriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));
  const apiRef = useGridApiRef();
  const [driverFilter, setDriverFilter] = useState("");
  const [startFilter, setStartFilter] = useState(null);
  const [endFilter, setEndFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState(null);

  const handleEdit = useCallback(
    (row) => {
      if (isSmall) {
        setEditRow(row);
      } else {
        apiRef.current.startRowEditMode({ id: row.id });
      }
    },
    [isSmall, apiRef],
  );

  const processRowUpdate = useCallback(async (newRow) => {
    await updateDoc(doc(db, "timeLogs", newRow.id), {
      driver: newRow.driverEmail,
    });
    return newRow;
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

    const columns = [
      { field: 'driverId', headerName: 'Driver', flex: 1, valueFormatter: ({ value }) => fmtText(value) },
      { field: 'rideId', headerName: 'Ride ID', width: 140, valueFormatter: ({ value }) => fmtText(value) },
      { field: 'startTime', headerName: 'Start', width: 180, valueFormatter: ({ value }) => fmtDateTime(value) },
      { field: 'endTime', headerName: 'End', width: 180, valueFormatter: ({ value }) => fmtDateTime(value) },
      { field: 'rideDuration', headerName: 'Duration', width: 110, valueFormatter: ({ value }) => fmtMinutes(value) },
      { field: 'loggedAt', headerName: 'Logged At', width: 180, valueFormatter: ({ value }) => fmtDateTime(value) },
      actionsCol({ onEdit: handleEdit, onDelete: handleDelete }),
    ];

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
            fmtDateTime(r.startTime),
            fmtDateTime(r.endTime),
            fmtDateTime(r.loggedAt),
            fmtMinutes(r.rideDuration),
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
    () => (filteredRows || []).filter(Boolean),
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
      {isSmall ? (
        <Stack spacing={2}>
          {safeRows.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{fmtText(r.driverId)}</Typography>
                  <Typography variant="body2">Ride ID: {fmtText(r.rideId)}</Typography>
                  <Typography variant="body2">Start: {fmtDateTime(r.startTime)}</Typography>
                  <Typography variant="body2">End: {fmtDateTime(r.endTime)}</Typography>
                  <Typography variant="body2">Duration: {fmtMinutes(r.rideDuration)}</Typography>
                  <Typography variant="body2">Logged: {fmtDateTime(r.loggedAt)}</Typography>
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
          <DataGridPro
            apiRef={apiRef}
            editMode="row"
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={() =>
              alert("Failed to update time log")
            }
            rows={safeRows ?? []}
            getRowId={(r) => r.id ?? r.rideId ?? r._id ?? `${r.pickupTime ?? r.start ?? 'row'}-${r.vehicle ?? ''}`}
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

