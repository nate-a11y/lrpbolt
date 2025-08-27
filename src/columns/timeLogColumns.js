/* Proprietary and confidential. See LICENSE. */
// src/columns/timeLogColumns.js
import { vfTime, vfDurationHM } from "../utils/vf";

import { buildNativeActionsColumn } from "./nativeActions.jsx";

/**
 * timeLogs doc shape:
 * driverName, driverEmail, rideId, clockIn, clockOut, durationMins, loggedAt, note?
 */
export function timeLogColumns(opts = {}) {
  const { withActions = false, onEdit, onDelete } = opts;

  const columns = [
    { field: "driverName", headerName: "Driver", minWidth: 160, flex: 0.8 },
    { field: "driverEmail", headerName: "Driver Email", minWidth: 220, flex: 1 },
    { field: "rideId", headerName: "Ride ID", minWidth: 120, flex: 0.5 },
    {
      field: "clockIn",
      headerName: "Clock In",
      minWidth: 170,
      flex: 0.8,
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        (p1?.row?.clockIn?.seconds ?? -1) - (p2?.row?.clockIn?.seconds ?? -1),
    },
    {
      field: "clockOut",
      headerName: "Clock Out",
      minWidth: 170,
      flex: 0.8,
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        (p1?.row?.clockOut?.seconds ?? -1) - (p2?.row?.clockOut?.seconds ?? -1),
    },
    {
      field: "durationMins",
      headerName: "Duration",
      minWidth: 130,
      flex: 0.6,
      valueFormatter: vfDurationHM,
    },
    {
      field: "loggedAt",
      headerName: "Logged At",
      minWidth: 170,
      flex: 0.8,
      valueFormatter: vfTime,
    },
    { field: "note", headerName: "Note", minWidth: 240, flex: 1.2 },
  ];

  if (withActions)
    columns.push(buildNativeActionsColumn({ onEdit, onDelete }));

  return columns;
}
