import { tsToDayjs } from "@/utils/timeUtils.js";

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
};

const toTrimmedString = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    const joined = value.map((item) => toTrimmedString(item)).filter(Boolean);
    if (joined.length > 0) {
      return joined.join(", ");
    }
    return null;
  }
  if (value && typeof value === "object") {
    const preferred = toTrimmedString(
      value.label ??
        value.name ??
        value.displayName ??
        value.title ??
        value.text ??
        value.description ??
        value.summary ??
        value.value ??
        value.id ??
        value.code ??
        value.plate ??
        value.licensePlate ??
        value.unit ??
        value.number,
    );
    if (preferred) return preferred;

    if (value.make || value.model) {
      const makeModel = [
        toTrimmedString(value.make),
        toTrimmedString(value.model),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (makeModel) {
        const trimName = toTrimmedString(value.trim);
        return [makeModel, trimName].filter(Boolean).join(" ");
      }
    }

    if (
      typeof value.toString === "function" &&
      value.toString !== Object.prototype.toString
    ) {
      const custom = String(value).trim();
      if (custom && custom !== "[object Object]") {
        return custom;
      }
    }
    return null;
  }
  return null;
};

const toNotesString = (value) => {
  if (!value) return toTrimmedString(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => toNotesString(item)).filter(Boolean);
    return items.length > 0 ? items.join(", ") : null;
  }
  if (typeof value === "object") {
    const text = toTrimmedString(
      value.text ?? value.note ?? value.message ?? value.body,
    );
    if (text) return text;
  }
  return toTrimmedString(value);
};

const toNumberSafe = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    if (typeof value.minutes === "number") {
      return Number.isFinite(value.minutes) ? value.minutes : null;
    }
    if (typeof value.value === "number") {
      return Number.isFinite(value.value) ? value.value : null;
    }
  }
  return null;
};

const toDayjsOrNull = (value) => {
  try {
    const dj = tsToDayjs(value);
    return dj && dj.isValid() ? dj : null;
  } catch (error) {
    void error;
    return null;
  }
};

const toDateSafe = (value) => {
  const dj = toDayjsOrNull(value);
  if (!dj) return null;
  try {
    const date = dj.toDate();
    if (!(date instanceof Date)) return null;
    const time = date.getTime?.();
    return Number.isFinite(time) ? date : null;
  } catch (error) {
    void error;
    return null;
  }
};

const toMillis = (ts) => {
  const date = toDateSafe(ts);
  if (!date) return null;
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
};

export function normalizeRide(docSnap) {
  const raw =
    typeof docSnap?.data === "function" ? docSnap.data() || {} : docSnap || {};
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = toTrimmedString(
    firstDefined(
      docSnap?.id,
      raw.id,
      raw.docId,
      raw.documentId,
      raw.rideId,
      raw.rideID,
      raw.RideId,
      raw.RideID,
      raw.tripId,
      raw.tripID,
      raw.TripId,
      raw.TripID,
      raw.trip,
      raw.Trip,
    ),
  );

  const tripId = toTrimmedString(
    firstDefined(
      raw.tripId,
      raw.tripID,
      raw.TripId,
      raw.TripID,
      raw.trip,
      raw.Trip,
      raw.rideId,
      raw.rideID,
      raw.RideId,
      raw.RideID,
      raw.ticketId,
      raw.ticketID,
      raw.TicketId,
      raw.TicketID,
      raw.tripCode,
      raw.TripCode,
    ),
  );

  const pickupCandidate = firstDefined(
    raw.pickupTime,
    raw.pickup_time,
    raw.pickupAt,
    raw.pickup_at,
    raw.pickup,
    raw.PickupTime,
    raw.Pickup_time,
    raw.PickupAt,
    raw.Pickup_at,
    raw.Pickup,
    raw.startAt,
    raw.StartAt,
    raw.startTime,
    raw.StartTime,
  );
  const pickupTime = toDateSafe(pickupCandidate);

  const createdCandidate = firstDefined(
    raw.createdAt,
    raw.created_at,
    raw.created,
    raw.CreatedAt,
    raw.Created_at,
    raw.Created,
    raw.timestamp,
    raw.Timestamp,
  );
  const createdAt = toDateSafe(createdCandidate);

  const updatedCandidate = firstDefined(
    raw.updatedAt,
    raw.updated_at,
    raw.updated,
    raw.UpdatedAt,
    raw.Updated_at,
    raw.Updated,
    raw.lastUpdated,
    raw.LastUpdated,
  );
  const updatedAt = toDateSafe(updatedCandidate);

  const claimedCandidate = firstDefined(
    raw.claimedAt,
    raw.claimed_at,
    raw.claimedTime,
    raw.claimed,
    raw.ClaimedAt,
    raw.Claimed_at,
    raw.ClaimedTime,
    raw.Claimed,
  );
  const claimedAt = toDateSafe(claimedCandidate);

  const importedCandidate = firstDefined(
    raw.importedFromQueueAt,
    raw.imported_from_queue_at,
    raw.importedFromQueue_at,
  );
  const importedFromQueueAt = toDateSafe(importedCandidate);

  const claimedBy = toTrimmedString(
    firstDefined(
      raw.claimedBy,
      raw.claimer,
      raw.claimed_user,
      raw.assignedTo,
      raw.assigned_to,
      raw.ClaimedBy,
      raw.CLAIMED_BY,
    ),
  );

  const createdBy = toTrimmedString(
    firstDefined(
      raw.createdBy,
      raw.created_by,
      raw.CreatedBy,
      raw.Created_by,
      raw.createdUser,
      raw.CreatedUser,
      raw.createdByEmail,
      raw.creator,
      raw.Creator,
    ),
  );

  const lastModifiedBy = toTrimmedString(
    firstDefined(
      raw.lastModifiedBy,
      raw.last_modified_by,
      raw.LastModifiedBy,
      raw.Last_modified_by,
      raw.updatedBy,
      raw.UpdatedBy,
      raw.modifiedBy,
      raw.ModifiedBy,
    ),
  );

  const rideDuration = toNumberSafe(
    firstDefined(
      raw.rideDuration,
      raw.RideDuration,
      raw.duration,
      raw.Duration,
      raw.minutes,
      raw.minutesDuration,
      raw.durationMinutes,
      raw.DurationMinutes,
      raw.duration?.minutes,
    ),
  );

  const rideType = toTrimmedString(
    firstDefined(
      raw.rideType,
      raw.RideType,
      raw.type,
      raw.Type,
      raw.serviceType,
      raw.ServiceType,
      raw.category,
      raw.Category,
    ),
  );

  const vehicle = toTrimmedString(
    firstDefined(
      raw.vehicle,
      raw.Vehicle,
      raw.vehicleName,
      raw.VehicleName,
      raw.vehicleId,
      raw.vehicleID,
      raw.VehicleId,
      raw.VehicleID,
      raw.vehicle_id,
      raw.vehicleLabel,
      raw.vehicleDescription,
      raw.vehicleDisplay,
      raw.vehicleCode,
      raw.car,
      raw.Car,
      raw.unit,
      raw.Unit,
    ),
  );

  const rideNotes = toNotesString(
    firstDefined(
      raw.rideNotes,
      raw.RideNotes,
      raw.notes,
      raw.Notes,
      raw.note,
      raw.Note,
      raw.messages,
      raw.Messages,
      raw.description,
      raw.Description,
    ),
  );

  const status =
    toTrimmedString(
      firstDefined(
        raw.status,
        raw.Status,
        raw.state,
        raw.State,
        raw.queueStatus,
        raw.QueueStatus,
      ),
    ) || "queued";

  const pickupTimeMs = toMillis(pickupTime);
  const createdAtMs = toMillis(createdAt);
  const updatedAtMs = toMillis(updatedAt);
  const claimedAtMs = toMillis(claimedAt);
  const importedFromQueueAtMs = toMillis(importedFromQueueAt);

  return {
    id: id ?? null,
    tripId: tripId ?? null,
    pickupTime,
    pickupAt: pickupTime,
    pickupTimeMs,
    rideType,
    vehicle,
    status,
    rideDuration,
    rideNotes,
    createdAt,
    createdAtMs,
    createdBy,
    updatedAt,
    updatedAtMs,
    lastModifiedBy,
    claimedAt,
    claimedAtMs,
    claimedBy,
    importedFromQueueAt,
    importedFromQueueAtMs,
    _raw: raw,
  };
}

export function normalizeRideArray(input) {
  if (!input) return [];
  const source = Array.isArray(input)
    ? input
    : Array.isArray(input?.docs)
      ? input.docs
      : [];
  return source
    .map((item) => normalizeRide(item))
    .filter((item) => item !== null);
}
