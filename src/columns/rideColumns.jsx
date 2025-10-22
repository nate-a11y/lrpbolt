/* Proprietary and confidential. See LICENSE. */
// src/columns/rideColumns.jsx
import { vfTime, vfDurationHM, vfText } from "../utils/vf";
import { timestampSortComparator } from "../utils/timeUtils";

import { buildNativeActionsColumn } from "./nativeActions.jsx";

/**
 * MUI DataGrid v7 API migration:
 * valueGetter signature changed from (params) to (value, row, column, apiRef)
 * All resolver functions now accept row directly as parameter
 */

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

const asRaw = (row) => {
  if (!row || typeof row !== "object") return {};
  const raw = row._raw;
  return raw && typeof raw === "object" ? raw : {};
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

const PLACEHOLDER_NAMES = new Set([
  "unknown",
  "n/a",
  "na",
  "-",
  "none",
  "unassigned",
]);

const isPlaceholderName = (value) => {
  if (!value) return true;
  const text = textFromValue(value);
  if (!text) return true;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;
  if (PLACEHOLDER_NAMES.has(normalized)) return true;
  if (normalized.includes("attached")) return true;
  if (normalized === "claimed") return true;
  if (normalized === "claim") return true;
  return false;
};

const pickDisplayName = (...values) => {
  for (const value of values) {
    const text = textFromValue(value);
    if (text && !isPlaceholderName(text)) {
      return text;
    }
  }
  return null;
};

const resolveClaimBlockName = (candidate) => {
  if (!candidate || typeof candidate !== "object") return null;

  const directName = pickDisplayName(
    candidate.claimedByName,
    candidate.ClaimedByName,
    candidate.claimed_by_name,
    candidate.claimerName,
    candidate.claimer_name,
    candidate.claimedByDisplayName,
    candidate.claimed_by_display_name,
    candidate.claimerDisplayName,
    candidate.claimer_display_name,
    candidate.assigneeName,
    candidate.assignee_name,
    candidate.driverName,
    candidate.driver_name,
  );
  if (directName) return directName;

  const nestedClaimer =
    candidate.claimer ||
    candidate.claimedBy ||
    candidate.user ||
    candidate.assignee ||
    candidate.driver ||
    candidate.agent;

  const nestedName = pickDisplayName(
    nestedClaimer?.displayName,
    nestedClaimer?.name,
    nestedClaimer?.fullName,
    nestedClaimer?.profile?.displayName,
    nestedClaimer?.profile?.name,
    nestedClaimer?.profile?.fullName,
    nestedClaimer?.ClaimedByName,
    nestedClaimer?.claimedByName,
    nestedClaimer?.claimerName,
  );
  if (nestedName) return nestedName;

  const nestedId = pickDisplayName(
    candidate.claimerId,
    candidate.claimer_id,
    candidate.claimerRef,
    candidate.claimer_ref,
    candidate.claimerID,
    candidate.id,
    candidate.uid,
    candidate.userId,
    candidate.user_id,
    candidate.path,
    nestedClaimer?.id,
    nestedClaimer?.uid,
    nestedClaimer?.userId,
    nestedClaimer?.user_id,
    nestedClaimer?.ref,
    nestedClaimer?.reference,
    nestedClaimer?.ref?.id,
    nestedClaimer?.reference?.id,
  );
  if (nestedId) return nestedId;

  return null;
};

const resolveTripId = (_value, row) => {
  const raw = asRaw(row);
  return pickText(
    row?.tripId,
    raw?.tripId,
    raw?.tripID,
    raw?.TripId,
    raw?.TripID,
    row?.tripID,
    row?.TripId,
    row?.TripID,
    row?.rideId,
    raw?.rideId,
    raw?.rideID,
    raw?.RideId,
    raw?.RideID,
    row?.rideID,
    row?.RideId,
    row?.RideID,
    row?.trip,
    raw?.trip,
    raw?.Trip,
    row?.Trip,
    row?.ticketId,
    raw?.ticketId,
    raw?.ticketID,
    raw?.TicketId,
    raw?.TicketID,
    row?.ticketID,
    row?.TicketId,
    row?.TicketID,
    row?.tripCode,
    raw?.tripCode,
    raw?.TripCode,
    row?.TripCode,
  );
};

const resolvePickupTime = (_value, row) => {
  const raw = asRaw(row);
  return firstDefined(
    row?.pickupTime,
    raw?.pickupTime,
    row?.pickup_time,
    raw?.pickup_time,
    row?.pickupAt,
    raw?.pickupAt,
    row?.pickup_at,
    raw?.pickup_at,
    row?.pickup,
    raw?.pickup,
    row?.PickupTime,
    row?.Pickup_time,
    row?.PickupAt,
    row?.Pickup_at,
    row?.Pickup,
    row?.pickupTimeMs,
    raw?.pickupTimeMs,
    row?.startAt,
    raw?.startAt,
    row?.StartAt,
    row?.startTime,
    raw?.startTime,
    row?.StartTime,
  );
};

const resolveDropoffTime = (_value, row) => {
  const raw = asRaw(row);
  return firstDefined(
    row?.dropoffTime,
    raw?.dropoffTime,
    row?.dropoff_time,
    raw?.dropoff_time,
    row?.dropoffAt,
    raw?.dropoffAt,
    row?.dropoff_at,
    raw?.dropoff_at,
    row?.dropoff,
    raw?.dropoff,
    row?.DropoffTime,
    row?.Dropoff_time,
    row?.DropoffAt,
    row?.Dropoff_at,
    row?.Dropoff,
    row?.dropoffTimeMs,
    raw?.dropoffTimeMs,
    row?.endAt,
    raw?.endAt,
    row?.EndAt,
    row?.end_at,
    raw?.end_at,
    row?.End_at,
    row?.endTime,
    raw?.endTime,
    row?.EndTime,
  );
};

const resolveRideDuration = (_value, row) => {
  const raw = asRaw(row);
  const candidate = firstDefined(
    row?.rideDuration,
    raw?.rideDuration,
    row?.RideDuration,
    raw?.RideDuration,
    row?.duration,
    raw?.duration,
    row?.Duration,
    raw?.Duration,
    row?.minutes,
    raw?.minutes,
    row?.durationMinutes,
    raw?.durationMinutes,
    row?.DurationMinutes,
    raw?.DurationMinutes,
    row?.duration?.minutes,
    raw?.duration?.minutes,
  );
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === "string") {
    const parsed = Number(candidate.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveRideType = (_value, row) => {
  const raw = asRaw(row);
  return pickText(
    row?.rideType,
    raw?.rideType,
    raw?.RideType,
    row?.RideType,
    row?.type,
    raw?.type,
    row?.Type,
    row?.serviceType,
    raw?.serviceType,
    row?.ServiceType,
    row?.category,
    raw?.category,
    row?.Category,
  );
};

const resolveVehicle = (_value, row) => {
  const raw = asRaw(row);
  return (
    vehicleToText(row?.vehicle) ||
    vehicleToText(raw?.vehicle) ||
    pickText(
      row?.vehicleName,
      raw?.vehicleName,
      row?.VehicleName,
      row?.vehicleId,
      raw?.vehicleId,
      row?.vehicleID,
      row?.VehicleId,
      row?.VehicleID,
      row?.vehicle_id,
      raw?.vehicle_id,
      row?.car,
      raw?.car,
      row?.Car,
      row?.unit,
      raw?.unit,
      row?.Unit,
      row?.vehicleLabel,
      raw?.vehicleLabel,
      row?.VehicleLabel,
      row?.vehicleDescription,
      raw?.vehicleDescription,
      row?.VehicleDescription,
      row?.vehicleCode,
      raw?.vehicleCode,
      row?.VehicleCode,
      row?.vehicleDisplay,
      raw?.vehicleDisplay,
      row?.VehicleDisplay,
    )
  );
};

const resolveRideNotes = (_value, row) => {
  const raw = asRaw(row);
  return notesToText(
    firstDefined(
      row?.rideNotes,
      raw?.rideNotes,
      row?.RideNotes,
      row?.notes,
      raw?.notes,
      row?.Notes,
      row?.note,
      raw?.note,
      row?.Note,
      row?.messages,
      raw?.messages,
      row?.Messages,
      row?.description,
      raw?.description,
      row?.Description,
    ),
  );
};

const resolveClaimedBy = (_value, row) => {
  const raw = asRaw(row);
  const claimedName = pickDisplayName(
    row?.claimedByName,
    raw?.claimedByName,
    raw?.ClaimedByName,
    row?.claimed_by_name,
    raw?.claimed_by_name,
    row?.claimedByDisplayName,
    raw?.claimedByDisplayName,
    row?.claimed_by_display_name,
    raw?.claimed_by_display_name,
    row?.claimerName,
    raw?.claimerName,
    row?.claimer_name,
    raw?.claimer_name,
  );
  if (claimedName) return claimedName;

  const claimBlocks = [
    row?.claimedAs,
    raw?.claimedAs,
    row?.claim,
    raw?.claim,
    row?.claimed,
    raw?.claimed,
    row?.claimerDetails,
    raw?.claimerDetails,
    row?.claimerInfo,
    raw?.claimerInfo,
  ];

  for (const block of claimBlocks) {
    const resolved = resolveClaimBlockName(block);
    if (resolved) return resolved;
  }

  return pickDisplayName(
    row?.claimedBy,
    raw?.claimedBy,
    raw?.ClaimedBy,
    row?.ClaimedBy,
    row?.claimer,
    raw?.claimer,
    row?.claimed_user,
    raw?.claimed_user,
    row?.assignedTo,
    raw?.assignedTo,
    row?.AssignedTo,
  );
};

const resolveClaimedAt = (_value, row) => {
  const raw = asRaw(row);
  return firstDefined(
    row?.claimedAt,
    raw?.claimedAt,
    row?.claimedTime,
    raw?.claimedTime,
    row?.claimed,
    raw?.claimed,
    row?.claimedAtMs,
    raw?.claimedAtMs,
    row?.ClaimedAt,
    row?.Claimed_at,
    row?.ClaimedTime,
    raw?.ClaimedAt,
    raw?.Claimed_at,
    raw?.ClaimedTime,
  );
};

const resolveCreatedAt = (_value, row) => {
  const raw = asRaw(row);
  return firstDefined(
    row?.createdAt,
    raw?.createdAt,
    row?.created,
    raw?.created,
    row?.Created,
    row?.timestamp,
    raw?.timestamp,
    row?.Timestamp,
    row?.createdAtMs,
    raw?.createdAtMs,
    row?.CreatedAt,
    row?.Created_at,
    raw?.CreatedAt,
    raw?.Created_at,
  );
};

const resolveUpdatedAt = (_value, row) => {
  return firstDefined(
    row?.updatedAt,
    row?.updated,
    row?.Updated,
    row?.lastUpdated,
    row?.LastUpdated,
    row?.updatedAtMs,
    row?.UpdatedAt,
    row?.Updated_at,
  );
};

const resolveStatus = (_value, row) => {
  const raw = asRaw(row);
  return (
    pickText(
      row?.status,
      raw?.status,
      row?.Status,
      raw?.Status,
      row?.state,
      raw?.state,
      row?.State,
      row?.queueStatus,
      raw?.queueStatus,
      row?.QueueStatus,
    ) || "queued"
  );
};

export {
  resolveTripId,
  resolvePickupTime,
  resolveDropoffTime,
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
      valueGetter: resolveTripId,
      valueFormatter: (value) => vfText(value, null, null, null, "—"),
    },
    {
      field: "pickupTime",
      headerName: "Pickup",
      minWidth: 170,
      flex: 0.9,
      valueGetter: resolvePickupTime,
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        timestampSortComparator(
          resolvePickupTime(null, p1.row),
          resolvePickupTime(null, p2.row),
        ),
    },
    {
      field: "rideDuration",
      headerName: "Duration",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: resolveRideDuration,
      valueFormatter: vfDurationHM,
    },
    {
      field: "rideType",
      headerName: "Type",
      minWidth: 120,
      flex: 0.6,
      valueGetter: resolveRideType,
      valueFormatter: (value) => vfText(value, null, null, null, "—"),
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 160,
      flex: 0.8,
      valueGetter: resolveVehicle,
      valueFormatter: (value) => vfText(value, null, null, null, "—"),
    },
    {
      field: "claimedBy",
      headerName: "Claimed By",
      minWidth: 160,
      flex: 0.7,
      valueGetter: resolveClaimedBy,
      valueFormatter: (value) => vfText(value, null, null, null, "—"),
    },
    {
      field: "claimedAt",
      headerName: "Claimed At",
      minWidth: 170,
      flex: 0.9,
      valueGetter: resolveClaimedAt,
      valueFormatter: vfTime,
      sortComparator: (v1, v2, p1, p2) =>
        timestampSortComparator(
          resolveClaimedAt(null, p1.row),
          resolveClaimedAt(null, p2.row),
        ),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 120,
      flex: 0.6,
      valueGetter: resolveStatus,
      valueFormatter: (value) => vfText(value, null, null, null, "—"),
    },
    {
      field: "rideNotes",
      headerName: "Notes",
      minWidth: 220,
      flex: 1.2,
      valueGetter: resolveRideNotes,
      valueFormatter: (value) => vfText(value, null, null, null, "—"),
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.9,
      valueGetter: resolveCreatedAt,
      valueFormatter: vfTime,
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      minWidth: 170,
      flex: 0.9,
      valueGetter: resolveUpdatedAt,
      valueFormatter: vfTime,
    },
  ];

  if (withActions) columns.push(buildNativeActionsColumn({ onEdit, onDelete }));

  return columns;
}
