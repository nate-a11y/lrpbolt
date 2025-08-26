/* Proprietary and confidential. See LICENSE. */
import React, { useMemo } from "react";
import {
  DataGridPro,
  GridActionsCellItem,
  GridToolbarColumnsButton,
  GridToolbarContainer,
} from "@mui/x-data-grid-pro";
import {
  Box,
  Button,
  Tooltip,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import useGridProDefaults from "./grid/useGridProDefaults.js";
import { fmtDurationHM } from "../utils/rideFormatters";

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
        valueGetter: (p) => Number(p?.row?.rideDuration ?? 0),
        valueFormatter: (p) => (p?.value ? fmtDurationHM(p.value) : "—"),
        sortComparator: (a, b) => (a ?? -1) - (b ?? -1),
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

  const CustomToolbar = () => (
    <GridToolbarContainer sx={{ justifyContent: "space-between", px: 1 }}>
      <GridToolbarColumnsButton />
      {refreshRides && (
        <Tooltip title="Reload ride data from Google Sheets">
          <span>
            <Button
              onClick={refreshRides}
              disabled={loading}
              variant="outlined"
              color="primary"
              size="small"
              startIcon={
                loading ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : (
                  <RefreshIcon />
                )
              }
            >
              Refresh
            </Button>
          </span>
        </Tooltip>
      )}
    </GridToolbarContainer>
  );

  return (
    <Box sx={{ width: "100%", height: 600 }}>
      <DataGridPro
        {...grid}
        rows={rows ?? []}
        columns={columns}
        loading={loading}
        slots={{ toolbar: CustomToolbar }}
        getRowClassName={(params) => (params.row?.fading ? "fading" : "")}
        initialState={initialState}
      />
    </Box>
  );
}
