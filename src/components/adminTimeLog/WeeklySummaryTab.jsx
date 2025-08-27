/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState, useMemo, useCallback } from "react";
import { DataGridPro, GridToolbar, useGridApiRef } from "@mui/x-data-grid-pro";
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

import { vfText, vfNumber, safeVG, actionsCol } from "@/utils/gridFormatters";
import { getField } from "@/utils/gridCells";
import { asText } from "@/utils/grid/cell";

import useWeeklySummary from "../../hooks/useWeeklySummary";

import ToolsCell from "./cells/ToolsCell.jsx";

export default function WeeklySummaryTab() {
  const [err, setErr] = useState(null);
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));
  const apiRef = useGridApiRef();
  const [driverFilter, setDriverFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState(null);

  const summaryRows = useWeeklySummary({ driverFilter });
  const [rows, setRows] = useState([]);
  useEffect(() => {
    setRows(summaryRows);
  }, [summaryRows]);


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

  const processRowUpdate = useCallback((newRow) => {
    setRows((prev) => prev.map((r) => (r.id === newRow.id ? newRow : r)));
    return newRow;
  }, []);

  const handleEditSave = useCallback(() => {
    setRows((prev) => prev.map((r) => (r.id === editRow.id ? editRow : r)));
    setEditRow(null);
  }, [editRow]);

  const handleDelete = useCallback((row) => {
    if (!window.confirm("Remove this driver?")) return;
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }, []);

  useEffect(() => {
    if (rows) setErr(null);
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const driverVal = getField(r, "driver");
      const driverMatch = driverFilter
        ? asText(driverVal)
            ?.toLowerCase()
            .includes(driverFilter.toLowerCase())
        : true;
      const searchMatch = search
        ? [driverVal, r.trips, r.hours]
            .filter(Boolean)
            .some((v) =>
              String(v).toLowerCase().includes(search.toLowerCase()),
            )
        : true;
      return driverMatch && searchMatch;
    });
  }, [rows, driverFilter, search]);

  const safeRows = useMemo(
    () => (filteredRows || []).filter(Boolean),
    [filteredRows],
  );

  const columns = useMemo(
    () => [
      {
        field: "driver",
        headerName: "Driver",
        flex: 1,
        minWidth: 200,
        valueGetter: safeVG(({ row }) => getField(row, "driver")),
        renderCell: (p) => {
          const v = p.value;
          if (v && typeof v === "string" && v.includes("@")) return v.split("@")[0];
          return asText(v);
        },
        valueFormatter: vfText,
      },
      {
        field: "trips",
        headerName: "Trips",
        width: 90,
        valueGetter: safeVG(({ row }) => row.trips),
        valueFormatter: vfNumber,
      },
      {
        field: "hours",
        headerName: "Hours",
        width: 110,
        valueGetter: safeVG(({ row }) => row.hours),
        valueFormatter: (p) =>
          Number.isFinite(p?.value) ? p.value.toFixed(2) : "",
      },
      {
        ...actionsCol(({ row }) => (
          <ToolsCell row={row} onEdit={handleEdit} onDelete={handleDelete} />
        )),
        headerName: "",
        width: 80,
        align: "center",
      },
    ],
    [handleEdit, handleDelete],
  );


  if (err) return <Alert severity="error" sx={{ m: 2 }}>{err}</Alert>;

  if (!rows.length) {
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
          {safeRows.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">
                    {(() => {
                      const v = getField(r, "driver");
                      if (v && typeof v === "string" && v.includes("@"))
                        return v.split("@")[0];
                      return asText(v) ?? "";
                    })()}
                  </Typography>
                  <Typography variant="body2">Trips: {r.trips}</Typography>
                  <Typography variant="body2">
                    Hours: {Number.isFinite(r.hours) ? r.hours.toFixed(2) : "0.00"}
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
        <DataGridPro
          apiRef={apiRef}
          editMode="row"
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={() => alert("Failed to update summary")}
          rows={safeRows ?? []}
          columns={columns}
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300, placeholder: "Search" },
            },
          }}
          pageSizeOptions={[5, 10, 25]}
          getRowId={(r) => r.id}
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
