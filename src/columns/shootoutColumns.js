/* Proprietary and confidential. See LICENSE. */
// src/columns/shootoutColumns.js
import { formatDateTime } from "../utils/timeUtils";

import { buildNativeActionsColumn } from "./nativeActions.jsx";

/**
 * shootoutStats doc shape:
 * driverEmail, vehicle, startTime, endTime, trips, passengers, createdAt
 */
export function shootoutColumns(opts = {}) {
  const { withActions = false, onEdit, onDelete } = opts;
  const columns = [
    { field: "driverEmail", headerName: "Driver Email", minWidth: 220, flex: 1 },
    { field: "vehicle", headerName: "Vehicle", minWidth: 160, flex: 0.8 },
    {
      field: "startTime",
      headerName: "Start",
      minWidth: 170,
      flex: 0.8,
      valueFormatter: (p) => formatDateTime(p.value),
      sortComparator: (v1, v2, p1, p2) =>
        (p1?.row?.startTime?.seconds ?? -1) - (p2?.row?.startTime?.seconds ?? -1),
    },
    {
      field: "endTime",
      headerName: "End",
      minWidth: 170,
      flex: 0.8,
      valueFormatter: (p) => formatDateTime(p.value),
      sortComparator: (v1, v2, p1, p2) =>
        (p1?.row?.endTime?.seconds ?? -1) - (p2?.row?.endTime?.seconds ?? -1),
    },
    { field: "trips", headerName: "Trips", minWidth: 110, flex: 0.5, type: "number" },
    { field: "passengers", headerName: "PAX", minWidth: 110, flex: 0.5, type: "number" },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.8,
      valueFormatter: (p) => formatDateTime(p.value),
    },
  ];

  if (withActions)
    columns.push(buildNativeActionsColumn({ onEdit, onDelete }));

  return columns;
}
