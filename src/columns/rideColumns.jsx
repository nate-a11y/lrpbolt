/* Proprietary and confidential. See LICENSE. */
// src/columns/rideColumns.jsx
import { vfTime, vfDurationHM } from "../utils/vf";

import { buildNativeActionsColumn } from "./nativeActions.jsx";

/**
 * Options:
 *  - withActions?: boolean
 *  - onEdit?: (row) => void
 *  - onDelete?: (row) => void
 */
export function rideColumns(opts = {}) {
  const { withActions = false, onEdit, onDelete } = opts;

  const columns = [
    { field: "tripId", headerName: "Trip ID", minWidth: 120, flex: 0.6 },
    {
      field: "pickupTime",
      headerName: "Pickup",
      minWidth: 170,
      flex: 0.9,
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        (p1?.row?.pickupTime?.seconds ?? -1) -
        (p2?.row?.pickupTime?.seconds ?? -1),
    },
    {
      field: "rideDuration",
      headerName: "Duration",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueFormatter: vfDurationHM,
    },
    { field: "rideType", headerName: "Type", minWidth: 120, flex: 0.6 },
    { field: "vehicle", headerName: "Vehicle", minWidth: 160, flex: 0.8 },
    { field: "claimedBy", headerName: "Claimed By", minWidth: 160, flex: 0.7 },
    {
      field: "claimedAt",
      headerName: "Claimed At",
      minWidth: 170,
      flex: 0.9,
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        (p1?.row?.claimedAt?.seconds ?? -1) -
        (p2?.row?.claimedAt?.seconds ?? -1),
    },
    { field: "status", headerName: "Status", minWidth: 120, flex: 0.6 },
    { field: "rideNotes", headerName: "Notes", minWidth: 220, flex: 1.2 },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.9,
      valueFormatter: vfTime,
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      minWidth: 170,
      flex: 0.9,
      valueFormatter: vfTime,
    },
  ];

  if (withActions) columns.push(buildNativeActionsColumn({ onEdit, onDelete }));

  return columns;
}
