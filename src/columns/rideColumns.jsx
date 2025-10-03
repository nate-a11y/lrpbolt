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

const asRow = (params) => {
  if (!params) return {};
  if (typeof params === "object" && "row" in params) {
    return params.row ?? {};
  }
  return params;
};

const resolveTripId = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.tripId, row?.tripID, row?.rideId, row?.trip);
};

const resolvePickupTime = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.pickupTime, row?.pickupAt, row?.pickup);
};

const resolveRideDuration = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(
    row?.rideDuration,
    row?.duration,
    row?.minutes,
    row?.durationMinutes,
    row?.duration?.minutes,
  );
};

const resolveRideType = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.rideType, row?.type);
};

const resolveVehicle = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(
    row?.vehicle,
    row?.vehicleName,
    row?.vehicleId,
    row?.vehicle_id,
  );
};

const resolveRideNotes = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.rideNotes, row?.notes);
};

const resolveClaimedBy = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.claimedBy, row?.claimer, row?.claimed_user);
};

const resolveClaimedAt = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.claimedAt, row?.claimedTime, row?.claimed);
};

const resolveCreatedAt = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.createdAt, row?.created, row?.timestamp);
};

const resolveUpdatedAt = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.updatedAt, row?.updated, row?.lastUpdated);
};

const resolveStatus = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return firstDefined(row?.status, row?.state);
};

export {
  resolveTripId,
  resolvePickupTime,
  resolveRideDuration,
  resolveRideType,
  resolveVehicle,
  resolveRideNotes,
  resolveClaimedBy,
  resolveClaimedAt,
  resolveCreatedAt,
  resolveUpdatedAt,
  resolveStatus,
};

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
      valueGetter: (params) => resolveTripId(params),
      valueFormatter: vfText,
    },
    {
      field: "pickupTime",
      headerName: "Pickup",
      minWidth: 170,
      flex: 0.9,
      valueGetter: (params) => resolvePickupTime(params),
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        timestampSortComparator(resolvePickupTime(p1), resolvePickupTime(p2)),
    },
    {
      field: "rideDuration",
      headerName: "Duration",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: (params) => resolveRideDuration(params),
      valueFormatter: vfDurationHM,
    },
    {
      field: "rideType",
      headerName: "Type",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (params) => resolveRideType(params),
      valueFormatter: vfText,
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (params) => resolveVehicle(params),
      valueFormatter: vfText,
    },
    {
      field: "claimedBy",
      headerName: "Claimed By",
      minWidth: 160,
      flex: 0.7,
      valueGetter: (params) => resolveClaimedBy(params),
      valueFormatter: vfText,
    },
    {
      field: "claimedAt",
      headerName: "Claimed At",
      minWidth: 170,
      flex: 0.9,
      valueGetter: (params) => resolveClaimedAt(params),
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        timestampSortComparator(resolveClaimedAt(p1), resolveClaimedAt(p2)),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (params) => resolveStatus(params),
      valueFormatter: vfText,
    },
    {
      field: "rideNotes",
      headerName: "Notes",
      minWidth: 220,
      flex: 1.2,
      valueGetter: (params) => resolveRideNotes(params),
      valueFormatter: vfText,
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.9,
      valueGetter: (params) => resolveCreatedAt(params),
      valueFormatter: vfTime,
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      minWidth: 170,
      flex: 0.9,
      valueGetter: (params) => resolveUpdatedAt(params),
      valueFormatter: vfTime,
    },
  ];

  if (withActions) columns.push(buildNativeActionsColumn({ onEdit, onDelete }));

  return columns;
}
