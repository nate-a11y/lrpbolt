/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { DataGridPro, GridToolbar, useGridApiRef } from "@mui/x-data-grid-pro";
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
import { DatePicker } from "@mui/x-date-pickers-pro";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";

import { getField } from '@/utils/gridCells';
import { fmtDateTime, fmtMinutes } from '@/utils/grid/datetime';
import { asText } from '@/utils/grid/cell';
import { durationMinutes, friendlyDateTime } from "@/utils/datetime";

import actionsCol from "../grid/actionsCol.jsx";
import { db } from "../../utils/firebaseInit";
import { subscribeShootoutStats } from "../../hooks/firestore";

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
      console.error(e);
      alert("Failed to update stat");
    }
  }, [editRow]);

  const handleDelete = useCallback(async (row) => {
    if (!window.confirm("Delete this stat?")) return;
    try {
      await deleteDoc(doc(db, "shootoutStats", row.id));
    } catch (e) {
      console.error(e);
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

  const rows = useMemo(() => stats || [], [stats]);

  const columns = [
    {
      field: "driver",
      headerName: "Driver",
      flex: 1,
      valueGetter: (p) => getField(p?.row ?? null, 'driver'),
      renderCell: (p) => {
        const v = p.value;
        if (v && typeof v === 'string' && v.includes('@')) return v.split('@')[0];
        return asText(v);
      },
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      flex: 1,
      valueGetter: (p) => getField(p?.row ?? null, 'vehicle'),
      renderCell: (p) => asText(p.value),
    },
    {
      field: "startTime",
      headerName: "Start",
      minWidth: 170,
      valueGetter: (p) => getField(p?.row ?? null, 'startTime'),
      valueFormatter: (p) => fmtDateTime(p.value),
    },
    {
      field: "endTime",
      headerName: "End",
      minWidth: 170,
      valueGetter: (p) => getField(p?.row ?? null, 'endTime'),
      valueFormatter: (p) => fmtDateTime(p.value),
    },
    {
      field: "duration",
      headerName: "Duration",
      width: 110,
      valueGetter: (p) => getField(p?.row ?? null, 'rideDuration'),
      valueFormatter: (p) => fmtMinutes(p.value),
    },
    { field: "trips", headerName: "Trips", width: 90 },
    { field: "passengers", headerName: "Pax", width: 90 },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      valueGetter: (p) => getField(p?.row ?? null, 'createdAt'),
      valueFormatter: (p) => fmtDateTime(p.value),
    },
    actionsCol({ onEdit: handleEdit, onDelete: handleDelete }),
  ];


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
            r.vehicle,
            r.trips,
            r.passengers,
            friendlyDateTime(r.startTime),
            friendlyDateTime(r.endTime),
            friendlyDateTime(r.createdAt),
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
          {safeRows.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">
                    {(() => {
                      const v = getField(r, "driver");
                      if (v && typeof v === "string" && v.includes("@")) return v.split("@")[0];
                      return asText(v) ?? "";
                    })()}
                  </Typography>
                  <Typography variant="body2">
                    Vehicle: {asText(getField(r, "vehicle")) ?? ""}
                  </Typography>
                  <Typography variant="body2">
                    Start: {friendlyDateTime(getField(r, "startTime"))}
                  </Typography>
                  <Typography variant="body2">
                    End: {friendlyDateTime(getField(r, "endTime"))}
                  </Typography>
                  <Typography variant="body2">Trips: {r.trips}</Typography>
                  <Typography variant="body2">Pax: {r.passengers}</Typography>
                  <Typography variant="body2">
                    Duration: {(() => {
                      const m =
                        getField(r, "rideDuration") ??
                        durationMinutes(getField(r, "startTime"), getField(r, "endTime"));
                      return m == null ? "—" : fmtMinutes(m);
                    })()}
                  </Typography>
                  <Typography variant="body2">
                    Created: {friendlyDateTime(getField(r, "createdAt"))}
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
          onProcessRowUpdateError={() => alert("Failed to update stat")}
          rows={safeRows ?? []}
          getRowId={(r) => r.id ?? r.rideId ?? r._id ?? `${r.pickupTime ?? r.start ?? 'row'}-${r.vehicle ?? ''}`}
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
