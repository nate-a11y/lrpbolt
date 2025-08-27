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
import { GridToolbar, useGridApiRef } from "@mui/x-data-grid-pro";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";

import { actionsCol } from "@/utils/gridFormatters";
import { formatDateTime, fmtMinutesHuman } from "../../utils/timeUtils.js";
import LRPDataGrid from "../LRPDataGrid.jsx";
import { timeLogColumns } from "../../columns/timeLogColumns.js";
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

    const columns = useMemo(
      () =>
        [
          ...timeLogColumns(),
          actionsCol(({ row }) => (
            <ToolsCell row={row} onEdit={handleEdit} onDelete={handleDelete} />
          )),
        ],
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
      {isSmall ? (
        <Stack spacing={2}>
          {safeRows.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">
                    {(() => {
                      const v = r.driver ?? r.driverEmail ?? "";
                      return v.includes("@") ? v.split("@")[0] : v;
                    })()}
                  </Typography>
                  <Typography variant="body2">
                    Ride ID: {r.rideId ?? ""}
                  </Typography>
                  <Typography variant="body2">
                    Start: {formatDateTime(r.startTime)}
                  </Typography>
                  <Typography variant="body2">
                    End: {formatDateTime(r.endTime)}
                  </Typography>
                  <Typography variant="body2">
                    Duration: {fmtMinutesHuman(r.duration)}
                  </Typography>
                  <Typography variant="body2">
                    Logged: {formatDateTime(r.loggedAt)}
                  </Typography>
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
          <LRPDataGrid
            apiRef={apiRef}
            editMode="row"
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={() =>
              alert("Failed to update time log")
            }
            rows={Array.isArray(safeRows) ? safeRows : []}
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
            autoHeight
            loading={loading}
            checkboxSelection={false}
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

