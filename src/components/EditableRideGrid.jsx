/* Proprietary and confidential. See LICENSE. */
import { useMemo, useEffect, useCallback } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";
import { Box, useMediaQuery, useTheme } from "@mui/material";

import { getField, fmtMinutes, fmtDateTime, asText } from "@/utils/gridCells";
import actionsCol from "./grid/actionsCol.jsx";
import { useGridDoctor } from "../utils/useGridDoctor";
import { dateCol, durationMinutes } from "@/utils/datetime";

export default function EditableRideGrid({
  rows,
  onDelete,
  onEdit,
  loading = false,
  refreshRides,
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
      dateCol("pickupTime", "Pickup", {
        flex: 1,
        valueGetter: ({ row }) => getField(row, "pickupTime"),
        valueFormatter: ({ value }) => fmtDateTime(value) ?? "",
      }),
      {
        field: "vehicle",
        headerName: "Vehicle",
        flex: 1,
        valueGetter: ({ row }) => getField(row, "vehicle"),
        renderCell: (p) => asText(p.value) ?? "",
      },
      {
        field: "rideType",
        headerName: "Type",
        flex: 1,
        valueGetter: ({ row }) => getField(row, "rideType"),
        renderCell: (p) => asText(p.value) ?? "",
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        width: 110,
        valueGetter: ({ row }) =>
          getField(row, "rideDuration") ??
          durationMinutes(
            getField(row, "pickupTime"),
            getField(row, "endTime") ?? getField(row, "dropoffTime"),
          ),
        valueFormatter: ({ value }) => fmtMinutes(value) ?? "",
        sortComparator: (a, b) => (Number(a) || 0) - (Number(b) || 0),
      },
      {
        field: "rideNotes",
        headerName: "Notes",
        flex: 1.5,
        valueGetter: ({ row }) => getField(row, "rideNotes"),
        renderCell: (p) => asText(p.value) ?? "",
      },
      actionsCol({
        onEdit: (row) => handleEdit(row),
        onDelete: (row) => handleDelete(row.id),
      }),
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
