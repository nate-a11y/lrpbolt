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

const textFromValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return Number.isFinite(Number(value)) ? String(value) : null;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => textFromValue(item))
      .filter(Boolean)
      .join(", ");
    return joined.length > 0 ? joined : null;
  }
  if (typeof value === "object") {
    if ("seconds" in value && "nanoseconds" in value) {
      return null; // Firestore Timestamp — let time formatters handle it.
    }

    if (value.make || value.model) {
      const makeModel = [textFromValue(value.make), textFromValue(value.model)]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (makeModel.length > 0) {
        const trimName = textFromValue(value.trim);
        return [makeModel, trimName].filter(Boolean).join(" ");
      }
    }

    const candidateKeys = [
      "label",
      "name",
      "displayName",
      "title",
      "text",
      "description",
      "summary",
      "note",
      "message",
      "body",
      "value",
      "code",
      "plate",
      "licensePlate",
      "unit",
      "number",
      "id",
    ];

    for (const key of candidateKeys) {
      if (value[key] !== undefined) {
        const text = textFromValue(value[key]);
        if (text) return text;
      }
    }

    if (
      typeof value.toString === "function" &&
      value.toString !== Object.prototype.toString
    ) {
      const custom = String(value).trim();
      if (custom && custom !== "[object Object]") return custom;
    }

    return null;
  }

  return null;
};

const notesToText = (value) => {
  if (Array.isArray(value)) {
    const items = value.map((item) => notesToText(item)).filter(Boolean);
    return items.length > 0 ? items.join(", ") : null;
  }
  if (value && typeof value === "object") {
    const text = textFromValue(
      value.text ?? value.note ?? value.message ?? value.body,
    );
    if (text) return text;
  }
  return textFromValue(value);
};

const vehicleToText = (value) => {
  if (!value) return textFromValue(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => vehicleToText(item)).filter(Boolean);
    return items.length > 0 ? items.join(", ") : null;
  }
  if (typeof value === "object") {
    const displayName = textFromValue(
      value.name ?? value.label ?? value.displayName,
    );
    const makeModel = [textFromValue(value.make), textFromValue(value.model)]
      .filter(Boolean)
      .join(" ")
      .trim();
    const descriptor = textFromValue(
      value.description ?? value.type ?? value.trim,
    );
    const identifier = textFromValue(
      value.plate ??
        value.licensePlate ??
        value.number ??
        value.unit ??
        value.id ??
        value.vehicleId,
    );

    const parts = [displayName, makeModel, descriptor, identifier]
      .filter(Boolean)
      .map((part) => part.trim())
      .filter((part, index, arr) => part && arr.indexOf(part) === index);

    if (parts.length > 0) {
      return parts.join(" • ");
    }
  }
  return textFromValue(value);
};

const pickText = (...values) => {
  for (const value of values) {
    const text = textFromValue(value);
    if (text) return text;
  }
  return null;
};

const resolveTripId = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return pickText(row?.tripId, row?.tripID, row?.rideId, row?.trip);
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
  return pickText(row?.rideType, row?.type, row?.serviceType);
};

const resolveVehicle = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return (
    vehicleToText(row?.vehicle) ||
    pickText(
      row?.vehicleName,
      row?.vehicleId,
      row?.vehicle_id,
      row?.car,
      row?.unit,
      row?.vehicleLabel,
      row?.vehicleDescription,
    )
  );
};

const resolveRideNotes = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return notesToText(
    firstDefined(row?.rideNotes, row?.notes, row?.note, row?.messages),
  );
};

const resolveClaimedBy = (rowOrParams) => {
  const row = asRow(rowOrParams);
  return pickText(
    row?.claimedBy,
    row?.claimer,
    row?.claimed_user,
    row?.assignedTo,
  );
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
  return pickText(row?.status, row?.state, row?.queueStatus);
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
      valueFormatter: (params) => vfText(params, "—"),
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
      valueFormatter: (params) => vfText(params, "—"),
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (params) => resolveVehicle(params),
      valueFormatter: (params) => vfText(params, "—"),
    },
    {
      field: "claimedBy",
      headerName: "Claimed By",
      minWidth: 160,
      flex: 0.7,
      valueGetter: (params) => resolveClaimedBy(params),
      valueFormatter: (params) => vfText(params, "—"),
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
      valueFormatter: (params) => vfText(params, "—"),
    },
    {
      field: "rideNotes",
      headerName: "Notes",
      minWidth: 220,
      flex: 1.2,
      valueGetter: (params) => resolveRideNotes(params),
      valueFormatter: (params) => vfText(params, "—"),
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
