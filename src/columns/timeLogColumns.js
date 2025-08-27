/* Proprietary and confidential. See LICENSE. */
// src/columns/timeLogColumns.js
import React from "react";
import { Stack, Tooltip, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { formatDateTime, minutesBetween, safeString, fmtMinutesHuman } from "../utils/timeUtils";
import { getField, getTsSec } from "../utils/rowAccess";

/**
 * timeLogs doc shape:
 * driverEmail, driver, rideId, startTime, endTime?, duration?, loggedAt, note?
 */
export function timeLogColumns(opts = {}) {
  const { withActions = false, onEdit, onDelete } = opts;

  const cols = [
    {
      field: "driver",
      headerName: "Driver",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => safeString(getField(p?.row, "driver") ?? getField(p?.row, "driverName")),
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 220,
      flex: 1,
      valueGetter: (p) => safeString(getField(p?.row, "driverEmail")),
    },
    {
      field: "rideId",
      headerName: "Ride ID",
      minWidth: 120,
      flex: 0.5,
      valueGetter: (p) => safeString(getField(p?.row, "rideId")),
    },
    {
      field: "startTime",
      headerName: "Clock In",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(getField(p?.row, "startTime")),
      sortComparator: (v1, v2, p1, p2) =>
        getTsSec(getField(p1?.row, "startTime")) - getTsSec(getField(p2?.row, "startTime")),
    },
    {
      field: "endTime",
      headerName: "Clock Out",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(getField(p?.row, "endTime")),
      sortComparator: (v1, v2, p1, p2) =>
        getTsSec(getField(p1?.row, "endTime")) - getTsSec(getField(p2?.row, "endTime")),
    },
    {
      field: "duration",
      headerName: "Duration",
      minWidth: 130,
      flex: 0.6,
      valueGetter: (p) => {
        const explicit = getField(p?.row, "duration");
        if (Number.isFinite(explicit)) return fmtMinutesHuman(explicit);
        const computed = minutesBetween(getField(p?.row, "startTime"), getField(p?.row, "endTime"));
        return fmtMinutesHuman(computed);
      },
      sortComparator: (v1, v2, p1, p2) => {
        const a = Number.isFinite(getField(p1?.row, "duration"))
          ? getField(p1?.row, "duration")
          : minutesBetween(getField(p1?.row, "startTime"), getField(p1?.row, "endTime")) ?? -1;
        const b = Number.isFinite(getField(p2?.row, "duration"))
          ? getField(p2?.row, "duration")
          : minutesBetween(getField(p2?.row, "startTime"), getField(p2?.row, "endTime")) ?? -1;
        return a - b;
      },
    },
    {
      field: "loggedAt",
      headerName: "Logged At",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(getField(p?.row, "loggedAt")),
    },
    {
      field: "note",
      headerName: "Note",
      minWidth: 240,
      flex: 1.2,
      valueGetter: (p) => safeString(getField(p?.row, "note"), ""),
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
      renderCell: (p) =>
        React.createElement(
          Stack,
          { direction: "row", spacing: 0.5 },
          typeof onEdit === "function"
            ? React.createElement(
                Tooltip,
                { title: "Edit" },
                React.createElement(
                  IconButton,
                  {
                    size: "small",
                    onClick: () => onEdit(p.row),
                    "aria-label": "Edit time log",
                  },
                  React.createElement(EditIcon, { fontSize: "inherit" })
                )
              )
            : null,
          typeof onDelete === "function"
            ? React.createElement(
                Tooltip,
                { title: "Delete" },
                React.createElement(
                  IconButton,
                  {
                    size: "small",
                    onClick: () => onDelete(p.row),
                    "aria-label": "Delete time log",
                  },
                  React.createElement(DeleteIcon, { fontSize: "inherit" })
                )
              )
            : null
        ),
    });
  }

  return cols;
}
