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
import dayjs from "../utils/dates";
import { TIMEZONE } from "../constants";

const fmtDate = (value) => {
  if (!value) return "N/A";
  try {
    const d = value.toDate ? value.toDate() : value;
    const dj = dayjs(d);
    return dj.isValid() ? dj.tz(TIMEZONE).format("MM/DD/YYYY") : "N/A";
  } catch {
    return "N/A";
  }
};

const fmtTime = (value) => {
  if (!value) return "N/A";
  try {
    const d = value.toDate ? value.toDate() : value;
    const dj = dayjs(d);
    return dj.isValid() ? dj.tz(TIMEZONE).format("h:mm A") : "N/A";
  } catch {
    return "N/A";
  }
};

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
        valueGetter: ({ row }) => row.pickupTime || null,
        valueFormatter: ({ value }) => fmtDate(value),
      },
      {
        field: "pickupTime",
        headerName: "Pickup Time",
        flex: 1,
        valueGetter: ({ row }) => row.pickupTime || null,
        valueFormatter: ({ value }) => fmtTime(value),
      },
      {
        field: "rideDuration",
        headerName: "Duration (min)",
        minWidth: 110,
        flex: 1,
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
        rows={rows}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        slots={{ toolbar: CustomToolbar }}
        getRowClassName={(params) => (params.row?.fading ? "fading" : "")}
      />
    </Box>
  );
}
