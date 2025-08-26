/* Proprietary and confidential. See LICENSE. */
import { useMemo, useCallback } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";
import { Box, useMediaQuery, useTheme } from "@mui/material";

import { getField } from '@/utils/gridCells';
import { fmtDateTime, fmtMinutes } from '@/utils/grid/datetime';
import { asText } from '@/utils/grid/cell';
import { dateCol, durationMinutes } from "@/utils/datetime";

import { useGridDoctor } from "../utils/useGridDoctor";

import actionsCol from "./grid/actionsCol.jsx";

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
      dateCol('pickupTime', 'Pickup', {
        flex: 1,
        valueGetter: (p) => getField(p?.row ?? null, 'pickupTime'),
        valueFormatter: (p) => fmtDateTime(p.value),
      }),
      {
        field: "vehicle",
        headerName: "Vehicle",
        flex: 1,
        valueGetter: (p) => getField(p?.row ?? null, 'vehicle'),
        renderCell: (p) => asText(p.value),
      },
      {
        field: "rideType",
        headerName: "Type",
        flex: 1,
        valueGetter: (p) => getField(p?.row ?? null, 'rideType'),
        renderCell: (p) => asText(p.value),
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        width: 110,
        valueGetter: (p) => {
          const r = p?.row ?? null;
          return (
            getField(r, 'rideDuration') ??
            durationMinutes(
              getField(r, 'pickupTime'),
              getField(r, 'endTime') ?? getField(r, 'dropoffTime'),
            )
          );
        },
        valueFormatter: (p) => fmtMinutes(p.value),
        sortComparator: (a, b) => (Number(a) || 0) - (Number(b) || 0),
      },
      {
        field: "rideNotes",
        headerName: "Notes",
        flex: 1.5,
        valueGetter: (p) => getField(p?.row ?? null, 'rideNotes'),
        renderCell: (p) => asText(p.value),
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
