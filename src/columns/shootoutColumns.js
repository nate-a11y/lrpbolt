/* Proprietary and confidential. See LICENSE. */
// src/columns/shootoutColumns.js
import { formatDateTime, safeNumber, safeString, minutesBetween, fmtMinutesHuman } from "../utils/timeUtils";
import { getField, getTsSec } from "../utils/rowAccess";

import { nativeActionsColumn } from "./nativeActions";

/**
 * shootoutStats doc shape:
 * driverEmail, vehicle, startTime, endTime?, trips, passengers, createdAt
 */
export function shootoutColumns(opts = {}) {
  const { withActions = false, onEdit, onDelete } = opts;
  const cols = [
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 220,
      flex: 1,
      valueGetter: (p) => safeString(getField(p?.row, "driverEmail")),
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => safeString(getField(p?.row, "vehicle")),
    },
    {
      field: "startTime",
      headerName: "Start",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(getField(p?.row, "startTime")),
      sortComparator: (v1, v2, p1, p2) =>
        getTsSec(getField(p1?.row, "startTime")) - getTsSec(getField(p2?.row, "startTime")),
    },
    {
      field: "endTime",
      headerName: "End",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(getField(p?.row, "endTime")),
      sortComparator: (v1, v2, p1, p2) =>
        getTsSec(getField(p1?.row, "endTime")) - getTsSec(getField(p2?.row, "endTime")),
    },
    {
      field: "sessionLength",
      headerName: "Session",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (p) =>
        fmtMinutesHuman(
          minutesBetween(getField(p?.row, "startTime"), getField(p?.row, "endTime"))
        ),
      sortComparator: (v1, v2, p1, p2) => {
        const a = minutesBetween(getField(p1?.row, "startTime"), getField(p1?.row, "endTime")) ?? -1;
        const b = minutesBetween(getField(p2?.row, "startTime"), getField(p2?.row, "endTime")) ?? -1;
        return a - b;
      },
    },
    {
      field: "trips",
      headerName: "Trips",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: (p) => safeNumber(getField(p?.row, "trips"), 0),
    },
    {
      field: "passengers",
      headerName: "PAX",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: (p) => safeNumber(getField(p?.row, "passengers"), 0),
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(getField(p?.row, "createdAt")),
    },
  ];

  if (withActions) cols.push(nativeActionsColumn({ onEdit, onDelete }));

  return cols;
}
