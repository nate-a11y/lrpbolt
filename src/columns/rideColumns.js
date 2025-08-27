/* Proprietary and confidential. See LICENSE. */
// src/columns/rideColumns.js
import { formatDateTime, safeNumber, safeString } from "../utils/timeUtils";

/**
 * Rides-like docs used by:
 * - liveRides
 * - claimedRides
 * - rideQueue
 *
 * Fields in your screenshots & rules:
 * tripId (string, required)
 * pickupTime (timestamp, required)
 * rideDuration (number minutes)
 * rideType (string)
 * vehicle (string)
 * rideNotes (string)
 * claimedBy | ClaimedBy (string)
 * claimedAt | ClaimedAt (timestamp)
 * status (string)
 * createdAt (timestamp)
 * createdBy (string)
 * updatedAt (timestamp|null)
 * lastModifiedBy (string)
 */

function claimedByAny(row) {
  return row?.claimedBy ?? row?.ClaimedBy ?? null;
}
function claimedAtAny(row) {
  return row?.claimedAt ?? row?.ClaimedAt ?? null;
}

export function rideColumns() {
  return [
    {
      field: "tripId",
      headerName: "Trip ID",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (p) => safeString(p?.row?.tripId),
    },
    {
      field: "pickupTime",
      headerName: "Pickup",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(p?.row?.pickupTime),
      sortComparator: (v1, v2, p1, p2) => {
        const a = p1?.row?.pickupTime?.seconds ?? 0;
        const b = p2?.row?.pickupTime?.seconds ?? 0;
        return a - b;
      },
    },
    {
      field: "rideDuration",
      headerName: "Dur (min)",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: (p) => safeNumber(p?.row?.rideDuration, 0),
    },
    {
      field: "rideType",
      headerName: "Type",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (p) => safeString(p?.row?.rideType),
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => safeString(p?.row?.vehicle),
    },
    {
      field: "claimedBy",
      headerName: "Claimed By",
      minWidth: 160,
      flex: 0.7,
      valueGetter: (p) => safeString(claimedByAny(p?.row)),
    },
    {
      field: "claimedAt",
      headerName: "Claimed At",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(claimedAtAny(p?.row)),
      sortComparator: (v1, v2, p1, p2) => {
        const a = claimedAtAny(p1?.row)?.seconds ?? -1;
        const b = claimedAtAny(p2?.row)?.seconds ?? -1;
        return a - b;
      },
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (p) => safeString(p?.row?.status),
    },
    {
      field: "rideNotes",
      headerName: "Notes",
      minWidth: 220,
      flex: 1.2,
      valueGetter: (p) => safeString(p?.row?.rideNotes, ""),
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(p?.row?.createdAt),
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(p?.row?.updatedAt),
    },
  ];
}
