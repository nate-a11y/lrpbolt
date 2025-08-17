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
import { fmtDateTS, fmtTimeTS, minutesHHMM } from "../utils/gridFx";

export default function EditableRideGrid({
  rows,
  onDelete,
  onEdit,
  loading = false,
  refreshRides,
}) {
  const columns = useMemo(
    () => [
      { field: "tripId", headerName: "Trip ID", flex: 1.1, minWidth: 140 },
      {
        field: "pickupDate",
        headerName: "Date",
        flex: 0.9,
        minWidth: 120,
        valueGetter: (params) => params?.row?.pickupTime ?? null,
        valueFormatter: (params) => fmtDateTS(params?.value),
        sortable: true,
      },
      {
        field: "pickupTimeDisplay",
        headerName: "Pickup Time",
        flex: 0.9,
        minWidth: 130,
        valueGetter: (params) => params?.row?.pickupTime ?? null,
        valueFormatter: (params) => fmtTimeTS(params?.value),
        sortable: true,
      },
      {
        field: "rideDurationDisplay",
        headerName: "Duration",
        flex: 0.7,
        minWidth: 110,
        valueGetter: (params) => {
          const v = params?.row?.rideDuration;
          const n = typeof v === "number" ? v : Number(v);
          return Number.isFinite(n) ? n : null;
        },
        valueFormatter: (params) => minutesHHMM(params?.value),
        sortable: true,
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
