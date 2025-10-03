/* Proprietary and confidential. See LICENSE. */
// src/columns/rideColumns.jsx
import { vfTime, vfDurationHM, vfText } from "../utils/vf";
import { timestampSortComparator } from "../utils/timeUtils";

import { buildNativeActionsColumn } from "./nativeActions.jsx";

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

const resolveTripId = (row) =>
  firstDefined(row?.tripId, row?.tripID, row?.rideId, row?.trip);

const resolvePickupTime = (row) =>
  firstDefined(row?.pickupTime, row?.pickupAt, row?.pickup);

const resolveRideDuration = (row) =>
  firstDefined(
    row?.rideDuration,
    row?.duration,
    row?.minutes,
    row?.durationMinutes,
    row?.duration?.minutes,
  );

const resolveRideType = (row) => firstDefined(row?.rideType, row?.type);

const resolveVehicle = (row) =>
  firstDefined(row?.vehicle, row?.vehicleName, row?.vehicleId, row?.vehicle_id);

const resolveRideNotes = (row) => firstDefined(row?.rideNotes, row?.notes);

const resolveClaimedBy = (row) =>
  firstDefined(row?.claimedBy, row?.claimer, row?.claimed_user);

const resolveClaimedAt = (row) =>
  firstDefined(row?.claimedAt, row?.claimedTime, row?.claimed);

const resolveCreatedAt = (row) =>
  firstDefined(row?.createdAt, row?.created, row?.timestamp);

const resolveUpdatedAt = (row) =>
  firstDefined(row?.updatedAt, row?.updated, row?.lastUpdated);

const resolveStatus = (row) => firstDefined(row?.status, row?.state);

/**
 * Options:
 *  - withActions?: boolean
 *  - onEdit?: (row) => void
 *  - onDelete?: (row) => void
 */
export function rideColumns(opts = {}) {
  const { withActions = false, onEdit, onDelete } = opts;

  const columns = [
    {
      field: "tripId",
      headerName: "Trip ID",
      minWidth: 120,
      flex: 0.6,
      valueGetter: ({ row }) => resolveTripId(row),
      valueFormatter: vfText,
    },
    {
      field: "pickupTime",
      headerName: "Pickup",
      minWidth: 170,
      flex: 0.9,
      valueGetter: ({ row }) => resolvePickupTime(row),
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        timestampSortComparator(
          resolvePickupTime(p1?.row),
          resolvePickupTime(p2?.row),
        ),
    },
    {
      field: "rideDuration",
      headerName: "Duration",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: ({ row }) => resolveRideDuration(row),
      valueFormatter: vfDurationHM,
    },
    {
      field: "rideType",
      headerName: "Type",
      minWidth: 120,
      flex: 0.6,
      valueGetter: ({ row }) => resolveRideType(row),
      valueFormatter: vfText,
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 160,
      flex: 0.8,
      valueGetter: ({ row }) => resolveVehicle(row),
      valueFormatter: vfText,
    },
    {
      field: "claimedBy",
      headerName: "Claimed By",
      minWidth: 160,
      flex: 0.7,
      valueGetter: ({ row }) => resolveClaimedBy(row),
      valueFormatter: vfText,
    },
    {
      field: "claimedAt",
      headerName: "Claimed At",
      minWidth: 170,
      flex: 0.9,
      valueGetter: ({ row }) => resolveClaimedAt(row),
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        timestampSortComparator(
          resolveClaimedAt(p1?.row),
          resolveClaimedAt(p2?.row),
        ),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 120,
      flex: 0.6,
      valueGetter: ({ row }) => resolveStatus(row),
      valueFormatter: vfText,
    },
    {
      field: "rideNotes",
      headerName: "Notes",
      minWidth: 220,
      flex: 1.2,
      valueGetter: ({ row }) => resolveRideNotes(row),
      valueFormatter: vfText,
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.9,
      valueGetter: ({ row }) => resolveCreatedAt(row),
      valueFormatter: vfTime,
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      minWidth: 170,
      flex: 0.9,
      valueGetter: ({ row }) => resolveUpdatedAt(row),
      valueFormatter: vfTime,
    },
  ];

  if (withActions) columns.push(buildNativeActionsColumn({ onEdit, onDelete }));

  return columns;
}
