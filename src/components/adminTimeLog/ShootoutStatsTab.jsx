/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { DataGrid, GridToolbar, useGridApiRef } from "@mui/x-data-grid";
import {
  Box,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  Typography,
  useMediaQuery,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../utils/firebaseInit";
import { subscribeShootoutStats } from "../../hooks/firestore";
import { tsToDate, fmtDateTime } from "../../utils/timeUtilsSafe";
import ToolsCell from "./cells/ToolsCell.jsx";

export default function ShootoutStatsTab() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);
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
    await updateDoc(doc(db, "shootoutStats", newRow.id), {
      status: newRow.status,
    });
    return newRow;
  }, []);

  const handleEditSave = useCallback(async () => {
    try {
      await updateDoc(doc(db, "shootoutStats", editRow.id), {
        status: editRow.status,
      });
      setEditRow(null);
    } catch (e) {
      alert("Failed to update stat");
    }
  }, [editRow]);

  const handleDelete = useCallback(async (row) => {
    if (!window.confirm("Delete this stat?")) return;
    try {
      await deleteDoc(doc(db, "shootoutStats", row.id));
    } catch (e) {
      alert("Failed to delete stat");
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      (rows) => setStats(rows || []),
      (e) => setErr(e?.message || "Failed to load"),
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const rows = useMemo(
    () =>
      (stats || []).map((r, i) => ({
        id: r.id || i,
        driverEmail: r.driverEmail || "",
        trips: Number(r.trips || 0),
        passengers: Number(r.passengers || 0),
        duration: Number(r.duration || 0),
        status: r.status || "",
        startTime: tsToDate(r.startTime),
        endTime: tsToDate(r.endTime),
        createdAt: tsToDate(r.createdAt),
      })),
    [stats]
  );

  const columns = useMemo(
    () => [
      { field: "driverEmail", headerName: "Driver", flex: 1 },
      { field: "trips", headerName: "Trips", width: 90, type: "number" },
      { field: "passengers", headerName: "Pax", width: 90, type: "number" },
      {
        field: "duration",
        headerName: "Duration",
        width: 110,
        type: "number",
        valueFormatter: (p = {}) => `${Math.round((p.value || 0) / 60)} min`,
      },
      { field: "status", headerName: "Status", width: 110, editable: true },
      {
        field: "startTime",
        headerName: "Start",
        flex: 1,
        minWidth: 170,
        valueGetter: (params = {}) => params?.row?.startTime ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
      },
      {
        field: "endTime",
        headerName: "End",
        flex: 1,
        minWidth: 170,
        valueGetter: (params = {}) => params?.row?.endTime ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
      },
      {
        field: "createdAt",
        headerName: "Created",
        flex: 1,
        minWidth: 170,
        valueGetter: (params = {}) => params?.row?.createdAt ?? null,
        valueFormatter: (params = {}) => fmtDateTime(params?.value),
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
    [handleEdit, handleDelete]
  );

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const driverMatch = driverFilter
        ? r.driverEmail?.toLowerCase().includes(driverFilter.toLowerCase())
        : true;
      const startMatch = startFilter
        ? r.startTime?.getTime() >= startFilter.toDate().getTime()
        : true;
      const endMatch = endFilter
        ? r.endTime?.getTime() <= endFilter.toDate().getTime()
        : true;
      const searchMatch = search
        ? [
            r.driverEmail,
            r.status,
            r.trips,
            r.passengers,
            r.duration,
            fmtDateTime(r.startTime),
            fmtDateTime(r.endTime),
            fmtDateTime(r.createdAt),
          ]
            .filter(Boolean)
            .some((v) =>
              String(v).toLowerCase().includes(search.toLowerCase()),
            )
        : true;
      return driverMatch && startMatch && endMatch && searchMatch;
    });
  }, [rows, driverFilter, startFilter, endFilter, search]);

  if (err) return <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>;
  if (!stats) return <CircularProgress sx={{ m: 2 }} />;

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
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
          {filteredRows.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{r.driverEmail}</Typography>
                  <Typography variant="body2">Trips: {r.trips}</Typography>
                  <Typography variant="body2">Passengers: {r.passengers}</Typography>
                  <Typography variant="body2">
                    Duration: {Math.round(r.duration / 60)} min
                  </Typography>
                  <Typography variant="body2">Status: {r.status}</Typography>
                  <Typography variant="body2">Start: {fmtDateTime(r.startTime)}</Typography>
                  <Typography variant="body2">End: {fmtDateTime(r.endTime)}</Typography>
                  <Typography variant="body2">Created: {fmtDateTime(r.createdAt)}</Typography>
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
        <DataGrid
          apiRef={apiRef}
          editMode="row"
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={() => alert("Failed to update stat")}
          rows={filteredRows}
          columns={columns}
          density="compact"
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[5, 10, 25]}
          disableRowSelectionOnClick
          autoHeight
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300, placeholder: "Search" },
            },
          }}
        />
      )}
      <Dialog open={!!editRow} onClose={() => setEditRow(null)}>
        <DialogTitle>Edit Status</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Status"
            value={editRow?.status || ""}
            onChange={(e) =>
              setEditRow((r) => ({ ...r, status: e.target.value }))
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
    </Box>
  );
}
