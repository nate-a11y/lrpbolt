/* Proprietary and confidential. See LICENSE. */
import { useMemo, useEffect, useCallback } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";
import { Box, useMediaQuery, useTheme } from "@mui/material";

import { safeRow } from "@/utils/gridUtils";
import { fmtDuration } from "../utils/timeUtils";
import { withSafeColumns } from "../utils/gridFormatters";
import { actionsColFactory } from "./grid/actionsCol";
import { useGridDoctor } from "../utils/useGridDoctor";

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

  const rawColumns = useMemo(
    () => [
      { field: "tripId", headerName: "Trip ID", flex: 1.1, minWidth: 140 },
      { field: "pickupDateStr", headerName: "Date", flex: 0.9, minWidth: 120 },
      {
        field: "pickupTimeStr",
        headerName: "Pickup Time",
        flex: 0.9,
        minWidth: 130,
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        flex: 0.7,
        minWidth: 110,
        valueGetter: (p) => {
          const r = safeRow(p);
          return r ? { s: 0, e: r.rideDuration ? r.rideDuration * 60000 : 0 } : null;
        },
        valueFormatter: (params = {}) =>
          params?.value ? fmtDuration(params.value.s, params.value.e) : "—",
        sortComparator: (a, b) => {
          const da = (a?.e ?? 0) - (a?.s ?? 0);
          const db = (b?.e ?? 0) - (b?.s ?? 0);
          return da - db;
        },
      },
      { field: "rideType", headerName: "Ride Type", flex: 1, minWidth: 140 },
      { field: "vehicle", headerName: "Vehicle", flex: 1, minWidth: 160 },
      { field: "rideNotes", headerName: "Notes", flex: 1.2, minWidth: 180 },
      { field: "createdBy", headerName: "Created By", flex: 1, minWidth: 160 },
      {
        field: "lastModifiedBy",
        headerName: "Modified By",
        flex: 1,
        minWidth: 160,
      },
      actionsColFactory({
        onEdit: (_id, row) => handleEdit(row),
        onDelete: (_id, row) => handleDelete(row.id),
      }),
    ],
    [handleEdit, handleDelete],
  );

  const columns = useMemo(() => withSafeColumns(rawColumns), [rawColumns]);

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
