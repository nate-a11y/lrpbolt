/* Proprietary and confidential. See LICENSE. */
import { useMemo, useCallback } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";
import { Box, useMediaQuery, useTheme, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { getField } from "@/utils/gridCells";
import { durationMinutes } from "@/utils/datetime";
import { actionsCol } from "@/utils/gridFormatters";
import { vfTime, vfNumber } from "@/utils/vf";

import { useGridDoctor } from "../utils/useGridDoctor";

export default function EditableRideGrid({
  rows,
  onDelete,
  onEdit,
  loading = false,
}) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const initialState = useMemo(
    () => ({
      columns: {
        columnVisibilityModel: {
          rideNotes: !isXs,
          createdBy: !isXs,
          lastModifiedBy: !isXs,
        },
      },
    }),
    [isXs],
  );
  const handleEdit = useCallback(
    (row) => {
      if (onEdit) onEdit(row);
    },
    [onEdit],
  );
  const handleDelete = useCallback(
    (id) => {
      if (onDelete) onDelete(id);
    },
    [onDelete],
  );

  const columns = useMemo(
    () => [
      { field: "tripId", headerName: "Ride ID", width: 110 },
      {
        field: "pickupTime",
        headerName: "Start",
        valueFormatter: vfTime,
      },
      {
        field: "endTime",
        headerName: "End",
        valueGetter: (p) =>
          p?.row?.endTime ?? p?.row?.dropoffTime ?? null,
        valueFormatter: vfTime,
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        valueGetter: (p) =>
          p?.row?.rideDuration ??
          durationMinutes(
            getField(p?.row, "pickupTime"),
            p?.row?.endTime ?? getField(p?.row, "dropoffTime"),
          ),
        valueFormatter: vfNumber,
        sortComparator: (a, b) => (Number(a) || 0) - (Number(b) || 0),
      },
      { field: "rideType", headerName: "Type", flex: 1 },
      { field: "vehicle", headerName: "Vehicle", flex: 1 },
      { field: "rideNotes", headerName: "Notes", flex: 1.5 },
      actionsCol(({ row }) => (
        <>
          <IconButton size="small" onClick={() => handleEdit(row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      )),
    ],
    [handleEdit, handleDelete],
  );

  const stableRows = useMemo(() => rows ?? [], [rows]);

  useGridDoctor({ name: "EditableRideGrid", rows: stableRows, columns });

  return (
    <Box sx={{ width: "100%", height: 600 }}>
      <DataGridPro
        rows={stableRows}
        columns={columns}
        loading={loading}
        checkboxSelection
        disableRowSelectionOnClick
        getRowClassName={(params) => (params.row?.fading ? "fading" : "")}
        initialState={initialState}
        getRowId={(r) => r.id}
      />
    </Box>
  );
}
