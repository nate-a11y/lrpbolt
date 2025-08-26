/* Proprietary and confidential. See LICENSE. */
import { useMemo, useCallback } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";
import { Box, useMediaQuery, useTheme, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { getField } from "@/utils/gridCells";
import { durationMinutes } from "@/utils/datetime";
import {
  vfText,
  vfDateTime,
  vfDuration,
  safeVG,
  actionsCol,
} from "@/utils/gridFormatters";

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
      {
        field: "tripId",
        headerName: "Ride ID",
        width: 110,
        valueGetter: safeVG(({ row }) => getField(row, "tripId")),
        valueFormatter: vfText,
      },
      {
        field: "pickupTime",
        headerName: "Start",
        valueGetter: safeVG(({ row }) => getField(row, "pickupTime")),
        valueFormatter: vfDateTime,
      },
      {
        field: "endTime",
        headerName: "End",
        valueGetter: safeVG(({ row }) =>
          getField(row, "endTime") ?? getField(row, "dropoffTime"),
        ),
        valueFormatter: vfDateTime,
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        valueGetter: safeVG(({ row }) =>
          getField(row, "rideDuration") ??
          durationMinutes(
            getField(row, "pickupTime"),
            getField(row, "endTime") ?? getField(row, "dropoffTime"),
          ),
        ),
        valueFormatter: vfDuration,
        sortComparator: (a, b) => (Number(a) || 0) - (Number(b) || 0),
      },
      {
        field: "rideType",
        headerName: "Type",
        flex: 1,
        valueGetter: safeVG(({ row }) => getField(row, "rideType")),
        valueFormatter: vfText,
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        flex: 1,
        valueGetter: safeVG(({ row }) => getField(row, "vehicle")),
        valueFormatter: vfText,
      },
      {
        field: "rideNotes",
        headerName: "Notes",
        flex: 1.5,
        valueGetter: safeVG(({ row }) => getField(row, "rideNotes")),
        valueFormatter: vfText,
      },
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
        getRowId={(r) => r.id ?? r._id}
      />
    </Box>
  );
}
