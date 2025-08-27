/* Proprietary and confidential. See LICENSE. */
// src/columns/rideColumns.jsx
import React from "react";
import { Stack, Tooltip, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { formatDateTime, safeNumber, safeString } from "../utils/timeUtils";
import { getField, getTsSec, getClaimedBy, getClaimedAt } from "../utils/rowAccess";

/**
 * Options:
 *  - withActions?: boolean
 *  - onEdit?: (row) => void
 *  - onDelete?: (row) => void
 */
export function rideColumns(opts = {}) {
  const { withActions = false, onEdit, onDelete } = opts;

  const cols = [
    {
      field: "tripId",
      headerName: "Trip ID",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (p) => safeString(getField(p?.row, "tripId")),
    },
    {
      field: "pickupTime",
      headerName: "Pickup",
      minWidth: 170,
      flex: 0.9,
      valueGetter: (p) => formatDateTime(getField(p?.row, "pickupTime")),
      sortComparator: (v1, v2, p1, p2) =>
        getTsSec(getField(p1?.row, "pickupTime")) - getTsSec(getField(p2?.row, "pickupTime")),
    },
    {
      field: "rideDuration",
      headerName: "Dur (min)",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: (p) => safeNumber(getField(p?.row, "rideDuration"), 0),
    },
    {
      field: "rideType",
      headerName: "Type",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (p) => safeString(getField(p?.row, "rideType")),
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => safeString(getField(p?.row, "vehicle")),
    },
    {
      field: "claimedBy",
      headerName: "Claimed By",
      minWidth: 160,
      flex: 0.7,
      valueGetter: (p) => safeString(getClaimedBy(p?.row)),
    },
    {
      field: "claimedAt",
      headerName: "Claimed At",
      minWidth: 170,
      flex: 0.9,
      valueGetter: (p) => formatDateTime(getClaimedAt(p?.row)),
      sortComparator: (v1, v2, p1, p2) =>
        getTsSec(getClaimedAt(p1?.row)) - getTsSec(getClaimedAt(p2?.row)),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (p) => safeString(getField(p?.row, "status")),
    },
    {
      field: "rideNotes",
      headerName: "Notes",
      minWidth: 220,
      flex: 1.2,
      valueGetter: (p) => safeString(getField(p?.row, "rideNotes"), ""),
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.9,
      valueGetter: (p) => formatDateTime(getField(p?.row, "createdAt")),
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      minWidth: 170,
      flex: 0.9,
      valueGetter: (p) => formatDateTime(getField(p?.row, "updatedAt")),
    },
  ];

  if (withActions) {
    cols.push({
      field: "__actions",
      headerName: "Actions",
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: "center",
      headerAlign: "center",
      minWidth: 120,
      flex: 0.5,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5}>
          {typeof onEdit === "function" && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => onEdit(p.row)} aria-label="Edit ride">
                <EditIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
          {typeof onDelete === "function" && (
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => onDelete(p.row)} aria-label="Delete ride">
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    });
  }

  return cols;
}
