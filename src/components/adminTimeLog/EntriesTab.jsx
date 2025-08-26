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

import { safeRow } from "@/utils/gridUtils";
import { fmtDateTimeCell, fmtPlain, toJSDate, dateSort, warnMissingFields } from "@/utils/gridFormatters";

import { fmtDuration } from "../../utils/timeUtils";
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

    const fmt = fmtDateTimeCell("America/Chicago", "—");

    const columns = useMemo(
      () => [
        {
          field: "driverEmail",
          headerName: "Driver",
          flex: 1,
          minWidth: 180,
          editable: true,
          valueFormatter: fmtPlain("—"),
        },
        {
          field: "rideId",
          headerName: "Ride ID",
          width: 120,
          valueFormatter: fmtPlain("—"),
        },
        {
          field: "startTime",
          headerName: "Start",
          flex: 1,
          minWidth: 160,
          valueGetter: (p) => toJSDate(safeRow(p)?.start ?? safeRow(p)?.startTime),
          valueFormatter: fmt,
          sortComparator: dateSort,
        },
        {
          field: "endTime",
          headerName: "End",
          flex: 1,
          minWidth: 160,
          valueGetter: (p) => toJSDate(safeRow(p)?.end ?? safeRow(p)?.endTime),
          valueFormatter: fmt,
          sortComparator: dateSort,
        },
        {
          field: "duration",
          headerName: "Duration",
          width: 120,
          valueGetter: (p) => {
            const r = safeRow(p);
            return { s: toJSDate(r?.start ?? r?.startTime), e: toJSDate(r?.end ?? r?.endTime) };
          },
          valueFormatter: (params) =>
            params?.value ? fmtDuration(params.value.s, params.value.e) : "—",
        },
        {
          field: "loggedAt",
          headerName: "Logged",
          flex: 1,
          minWidth: 160,
          valueGetter: (p) => toJSDate(safeRow(p)?.loggedAt),
          valueFormatter: fmtDateTimeCell("America/Chicago", "—"),
          sortComparator: dateSort,
        },
        {
          field: "tools",
          headerName: "",
          width: 80,
          sortable: false,
          filterable: false,
          disableColumnMenu: true,
          align: "center",
          renderCell: (params) => (
            <ToolsCell
              row={params.row}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ),
        },
      ],
      [handleEdit, handleDelete],
    );

    useEffect(() => {
      const unsub = subscribeTimeLogs(
        (logs) => {
          setRows(logs || []);
          warnMissingFields(columns, logs || []);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to load time logs.");
        setLoading(false);
      },
    );
    return () => typeof unsub === "function" && unsub();
  }, [columns]);

    const filteredRows = useMemo(() => {
      return (rows || []).filter((r) => {
        const driverMatch = driverFilter
        ? r.driverEmail?.toLowerCase().includes(driverFilter.toLowerCase())
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
            r.driverEmail,
            r.rideId,
            fmt({ value: r.startTime }),
            fmt({ value: r.endTime }),
            fmt({ value: r.loggedAt }),
            fmtDuration(r.startTime, r.endTime),
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
                  <Typography variant="subtitle2">{r.driverEmail}</Typography>
                  <Typography variant="body2">Ride ID: {r.rideId || "—"}</Typography>
                  <Typography variant="body2">Start: {fmt({ value: toJSDate(r.startTime) })}</Typography>
                  <Typography variant="body2">End: {fmt({ value: toJSDate(r.endTime) })}</Typography>
                  <Typography variant="body2">
                    Duration: {fmtDuration(r.startTime, r.endTime)}
                  </Typography>
                  <Typography variant="body2">Logged: {fmt({ value: toJSDate(r.loggedAt) })}</Typography>
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

