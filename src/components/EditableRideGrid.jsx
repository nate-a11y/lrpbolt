/* Proprietary and confidential. See LICENSE. */
import React, { useMemo } from "react";
import {
  DataGrid,
  GridActionsCellItem,
  GridToolbarColumnsButton,
  GridToolbarContainer,
} from "@mui/x-data-grid";
import {
  Box,
  Button,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  getPickupTime,
  getRideDuration,
  fmtDate,
  fmtTime,
  minutesToHHMM,
  safeVF,
} from "../utils/gridFormatters";

export default function EditableRideGrid({
  rows,
  onDelete,
  onEdit,
  loading = false,
  refreshRides,
}) {
  const columns = useMemo(
    () => [
      { field: "tripId", headerName: "Trip ID", minWidth: 120, flex: 1 },
      {
        field: "pickupDate",
        headerName: "Date",
        flex: 1,
        valueGetter: getPickupTime,
        valueFormatter: safeVF(fmtDate),
      },
      {
        field: "pickupTimeDisplay",
        headerName: "Pickup Time",
        flex: 1,
        valueGetter: getPickupTime,
        valueFormatter: safeVF(fmtTime),
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        minWidth: 110,
        flex: 1,
        valueGetter: getRideDuration,
        valueFormatter: safeVF((v) => minutesToHHMM(v)),
      },
      { field: "rideType", headerName: "Ride Type", minWidth: 120, flex: 1 },
      { field: "vehicle", headerName: "Vehicle", minWidth: 150, flex: 1.5 },
      { field: "rideNotes", headerName: "Notes", minWidth: 180, flex: 2 },
      { field: "createdBy", headerName: "Created By", minWidth: 140, flex: 1 },
      { field: "lastModifiedBy", headerName: "Modified By", minWidth: 140, flex: 1 },
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
      <DataGrid
        rows={rows || []}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        slots={{ toolbar: CustomToolbar }}
        getRowClassName={(params) => (params.row?.fading ? "fading" : "")}
      />
    </Box>
  );
}
