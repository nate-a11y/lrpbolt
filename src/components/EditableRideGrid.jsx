/* Proprietary and confidential. See LICENSE. */
import React, { useMemo } from "react";
import { DataGridPro, GridActionsCellItem } from "@mui/x-data-grid-pro";
import {
  Box,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import useGridProDefaults from "./grid/useGridProDefaults.js";
import { fmtDuration } from "../utils/timeUtils";

export default function EditableRideGrid({
  rows,
  onDelete,
  onEdit,
  loading = false,
  refreshRides,
}) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const grid = useGridProDefaults({ gridId: "rideQueue" });
  const initialState = useMemo(
    () => ({
      ...grid.initialState,
      columns: {
        ...grid.initialState.columns,
        columnVisibilityModel: {
          rideNotes: !isXs,
          createdBy: !isXs,
          lastModifiedBy: !isXs,
          ...grid.initialState.columns.columnVisibilityModel,
        },
      },
    }),
    [grid.initialState, isXs],
  );
  const columns = useMemo(
    () => [
      { field: "tripId", headerName: "Trip ID", flex: 1.1, minWidth: 140 },
      {
        field: "pickupDateStr",
        headerName: "Date",
        flex: 0.9,
        minWidth: 120,
      },
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
        valueGetter: ({ row }) => ({
          s: 0,
          e: row.rideDuration ? row.rideDuration * 60000 : 0,
        }),
        valueFormatter: ({ value }) => fmtDuration(value?.s, value?.e),
        sortComparator: (a, b) => {
          const da = (a?.e ?? 0) - (a?.s ?? 0);
          const db = (b?.e ?? 0) - (b?.s ?? 0);
          return da - db;
        },
      },
      { field: "rideType", headerName: "Ride Type", flex: 1, minWidth: 140 },
      { field: "vehicle", headerName: "Vehicle", flex: 1, minWidth: 160 },
      {
        field: "rideNotes",
        headerName: "Notes",
        flex: 1.2,
        minWidth: 180,
        valueFormatter: (p) => (p?.value ? String(p.value) : "N/A"),
      },
      { field: "createdBy", headerName: "Created By", flex: 1, minWidth: 160 },
      { field: "lastModifiedBy", headerName: "Modified By", flex: 1, minWidth: 160 },
      {
        field: "actions",
        type: "actions",
        width: 80,
        getActions: (params) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => onEdit && onEdit(params.row)}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => onDelete && onDelete(params.row.id)}
          />,
        ],
      },
    ],
    [onDelete, onEdit]
  );

  return (
    <Box sx={{ width: "100%", height: 600 }}>
      <DataGridPro
        {...grid}
        rows={rows ?? []}
        columns={columns}
        loading={loading}
        slotProps={{
          ...grid.slotProps,
          toolbar: {
            ...grid.slotProps?.toolbar,
            ...(refreshRides && {
              rightAction: refreshRides,
              rightActionLabel: "Refresh",
              rightActionProps: {
                disabled: loading,
                startIcon: loading ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : (
                  <RefreshIcon />
                ),
              },
            }),
          },
        }}
        getRowClassName={(params) => (params.row?.fading ? "fading" : "")}
        initialState={initialState}
      />
    </Box>
  );
}
