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

import { fmtDateTime, fmtMinutes } from "@/utils/datetime";
import {
  vfText,
  vfDateTime,
  vfDuration,
  vfNumber,
  safeVG,
  actionsCol,
} from "@/utils/gridFormatters";

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
      valueGetter: safeVG(({ row }) =>
        row.driver ?? row.driverName ?? row.driverEmail?.split("@")[0] ?? "",
      ),
      valueFormatter: vfText,
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      valueGetter: safeVG(({ row }) => row.vehicle ?? ""),
      valueFormatter: vfText,
    },
    {
      field: "startTime",
      headerName: "Start",
      valueGetter: safeVG(({ row }) => row.startTime),
      valueFormatter: vfDateTime,
    },
    {
      field: "endTime",
      headerName: "End",
      valueGetter: safeVG(({ row }) => row.endTime),
      valueFormatter: vfDateTime,
    },
    {
      field: "duration",
      headerName: "Duration",
      valueGetter: safeVG(({ row }) => row.duration ?? row.minutes),
      valueFormatter: vfDuration,
    },
    {
      field: "trips",
      headerName: "Trips",
      width: 90,
      valueGetter: safeVG(({ row }) => row.trips ?? row.tripCount ?? 0),
      valueFormatter: vfNumber,
    },
    {
      field: "pax",
      headerName: "Pax",
      width: 90,
      valueGetter: safeVG(({ row }) => row.pax ?? row.passengers ?? 0),
      valueFormatter: vfNumber,
    },
    {
      field: "createdAt",
      headerName: "Created",
      valueGetter: safeVG(({ row }) => row.createdAt),
      valueFormatter: vfDateTime,
    },
    actionsCol(({ row }) => (
      <ToolsCell row={row} onEdit={handleEdit} onDelete={handleDelete} />
    )),
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
            r.pax ?? r.passengers,
            fmtDateTime(r.startTime),
            fmtDateTime(r.endTime),
            fmtDateTime(r.createdAt),
            r.duration,
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
                      const v = r.driver ?? r.driverEmail ?? "";
                      return v.includes("@") ? v.split("@")[0] : v;
                    })()}
                  </Typography>
                  <Typography variant="body2">Vehicle: {r.vehicle ?? ""}</Typography>
                  <Typography variant="body2">Start: {fmtDateTime(r.startTime)}</Typography>
                  <Typography variant="body2">End: {fmtDateTime(r.endTime)}</Typography>
                  <Typography variant="body2">Trips: {r.trips}</Typography>
                  <Typography variant="body2">Pax: {r.pax ?? r.passengers}</Typography>
                  <Typography variant="body2">
                    Duration: {fmtMinutes(r.duration)}
                  </Typography>
                  <Typography variant="body2">
                    Created: {fmtDateTime(r.createdAt)}
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
          getRowId={(r) => r.id}
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
