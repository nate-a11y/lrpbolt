/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { DataGrid, GridToolbar, useGridApiRef } from "@mui/x-data-grid";
import {
  Box,
  CircularProgress,
  Alert,
  Typography,
  Stack,
  Paper,
  useMediaQuery,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { fetchWeeklySummary } from "../../hooks/firestore";
import ToolsCell from "./cells/ToolsCell.jsx";

export default function WeeklySummaryTab() {
  const [summary, setSummary] = useState(null);
  const [err, setErr] = useState(null);
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));
  const apiRef = useGridApiRef();
  const [driverFilter, setDriverFilter] = useState("");
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

  const processRowUpdate = useCallback(
    (newRow) => {
      setSummary((prev) =>
        prev.map((s) =>
          s.driver === newRow.driver
            ? { ...s, entries: newRow.trips, totalMinutes: newRow.hours * 60 }
            : s,
        ),
      );
      return newRow;
    },
    [],
  );

  const handleEditSave = useCallback(() => {
    setSummary((prev) =>
      prev.map((s) =>
        s.driver === editRow.driver
          ? { ...s, entries: editRow.trips, totalMinutes: editRow.hours * 60 }
          : s,
      ),
    );
    setEditRow(null);
  }, [editRow]);

  const handleDelete = useCallback((row) => {
    if (!window.confirm("Remove this driver?")) return;
    setSummary((prev) => prev.filter((s) => s.driver !== row.driver));
  }, []);

  useEffect(() => {
    let alive = true;
    fetchWeeklySummary()
      .then((data) => alive && setSummary(data))
      .catch((e) => setErr(e?.message || "Failed to load summary"));
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!summary) return [];
    return summary.map((item, i) => ({
      id: item.driver || i,
      driver: item.driver || "Unknown",
      trips: item.entries ?? 0,
      hours: (item.totalMinutes ?? 0) / 60,
    }));
  }, [summary]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const driverMatch = driverFilter
        ? r.driver.toLowerCase().includes(driverFilter.toLowerCase())
        : true;
      const searchMatch = search
        ? [r.driver, r.trips, r.hours]
            .filter(Boolean)
            .some((v) =>
              String(v).toLowerCase().includes(search.toLowerCase()),
            )
        : true;
      return driverMatch && searchMatch;
    });
  }, [rows, driverFilter, search]);

  const columns = useMemo(
    () => [
      { field: "driver", headerName: "Driver", flex: 1, minWidth: 200 },
      { field: "trips", headerName: "Trips", width: 110, type: "number", editable: true },
      {
        field: "hours",
        headerName: "Hours",
        width: 120,
        type: "number",
        editable: true,
        valueFormatter: (params = {}) => {
          const v = params?.value;
          return (typeof v === "number" ? v : 0).toFixed(2);
        },
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

  if (err) return <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>;

  if (!summary) {
    return (
      <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={22} />
        <Typography variant="body2">Loading weekly summary…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Weekly Driver Summary
      </Typography>
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
      </Box>
      {isSmall ? (
        <Stack spacing={2}>
          {filteredRows.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">{r.driver}</Typography>
                  <Typography variant="body2">Trips: {r.trips}</Typography>
                  <Typography variant="body2">Hours: {r.hours.toFixed(2)}</Typography>
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
          onProcessRowUpdateError={() => alert("Failed to update summary")}
          autoHeight
          rows={filteredRows}
          columns={columns}
          density="compact"
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300, placeholder: "Search" },
            },
          }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[5, 10, 25]}
        />
      )}
      <Dialog open={!!editRow} onClose={() => setEditRow(null)}>
        <DialogTitle>Edit Summary</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Trips"
            type="number"
            value={editRow?.trips ?? ""}
            onChange={(e) =>
              setEditRow((r) => ({ ...r, trips: Number(e.target.value) }))
            }
            fullWidth
          />
          <TextField
            margin="dense"
            label="Hours"
            type="number"
            value={editRow?.hours ?? ""}
            onChange={(e) =>
              setEditRow((r) => ({ ...r, hours: Number(e.target.value) }))
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
