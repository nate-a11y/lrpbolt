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

import { fmtText } from "@/utils/timeUtils";
import actionsCol from "../grid/actionsCol.jsx";
import { db } from "../../utils/firebaseInit";
import { subscribeTimeLogs } from "../../hooks/firestore";
import { friendlyDateTime, durationMinutes } from "@/utils/datetime";
import { fmtDateTimeCell, dateSort } from "@/utils/gridFormatters";

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
      {
        field: 'driverEmail',
        headerName: 'Driver',
        flex: 1,
        minWidth: 120,
        valueGetter: (p) => p?.row?.driverEmail ?? '',
        renderCell: (p) => fmtText(p?.value),
      },
      {
        field: 'rideId',
        headerName: 'Ride ID',
        width: 120,
        valueGetter: (p) => p?.row?.rideId ?? '',
        renderCell: (p) => fmtText(p?.value),
      },
      {
        field: 'startTime',
        headerName: 'Start',
        type: 'dateTime',
        minWidth: 170,
        valueGetter: (p) => p?.row?.startTime ?? null,
        renderCell: (p) => fmtDateTimeCell(p) || '',
        sortComparator: dateSort,
      },
      {
        field: 'endTime',
        headerName: 'End',
        type: 'dateTime',
        minWidth: 170,
        valueGetter: (p) => p?.row?.endTime ?? null,
        renderCell: (p) => fmtDateTimeCell(p) || '',
        sortComparator: dateSort,
      },
      {
        field: 'duration',
        headerName: 'Duration',
        width: 110,
        valueGetter: (p) => durationMinutes(p?.row?.startTime, p?.row?.endTime),
        renderCell: (p) => {
          const v = p?.value;
          if (v == null) return '';
          const mins = Number(v);
          if (Number.isNaN(mins)) return '';
          return `${mins}m`;
        },
        sortComparator: (a, b) => (a ?? -1) - (b ?? -1),
      },
      {
        field: 'loggedAt',
        headerName: 'Logged At',
        type: 'dateTime',
        minWidth: 170,
        valueGetter: (p) => p?.row?.loggedAt ?? null,
        renderCell: (p) => fmtDateTimeCell(p) || '',
        sortComparator: dateSort,
      },
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
            friendlyDateTime(r.startTime),
            friendlyDateTime(r.endTime),
            friendlyDateTime(r.loggedAt),
            durationMinutes(r.startTime, r.endTime),
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
                  <Typography variant="body2">Start: {friendlyDateTime(r.startTime)}</Typography>
                  <Typography variant="body2">End: {friendlyDateTime(r.endTime)}</Typography>
                  <Typography variant="body2">Duration: {(() => { const m = durationMinutes(r.startTime, r.endTime); return m == null ? '—' : `${m}m`; })()}</Typography>
                  <Typography variant="body2">Logged: {friendlyDateTime(r.loggedAt)}</Typography>
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

