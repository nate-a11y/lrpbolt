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

const toMillis = (ts) => {
  if (ts === null || ts === undefined) return null;
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "object") {
    if (typeof ts.toMillis === "function") {
      const result = Number(ts.toMillis());
      return Number.isFinite(result) ? result : null;
    }
    if (typeof ts.seconds === "number" || typeof ts.nanoseconds === "number") {
      const seconds = Number(ts.seconds || 0);
      const nanos = Number(ts.nanoseconds || 0);
      const ms = seconds * 1000 + Math.floor(nanos / 1e6);
      return Number.isFinite(ms) ? ms : null;
    }
  }
  return null;
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
      raw.rideId,
      raw.tripId,
      raw.trip,
    ),
  );

  const tripId = toTrimmedString(
    firstDefined(
      raw.tripId,
      raw.tripID,
      raw.trip,
      raw.rideId,
      raw.ticketId,
      raw.tripCode,
    ),
  );

  const pickupTime = firstDefined(
    raw.pickupTime,
    raw.pickupAt,
    raw.pickup_at,
    raw.pickup,
    raw.startAt,
    raw.startTime,
    raw.PickupTime,
  );

  const createdAt = firstDefined(
    raw.createdAt,
    raw.created_at,
    raw.created,
    raw.timestamp,
    raw.CreatedAt,
  );

  const updatedAt = firstDefined(
    raw.updatedAt,
    raw.updated_at,
    raw.updated,
    raw.lastUpdated,
    raw.UpdatedAt,
  );

  const claimedAt = firstDefined(
    raw.claimedAt,
    raw.claimed_at,
    raw.claimedTime,
    raw.claimed,
    raw.ClaimedAt,
  );

  const claimedBy = toTrimmedString(
    firstDefined(
      raw.claimedBy,
      raw.claimer,
      raw.claimed_user,
      raw.assignedTo,
      raw.ClaimedBy,
    ),
  );

  const rideDuration = toNumberSafe(
    firstDefined(
      raw.rideDuration,
      raw.duration,
      raw.minutes,
      raw.durationMinutes,
      raw.duration?.minutes,
    ),
  );

  const rideType = toTrimmedString(
    firstDefined(raw.rideType, raw.type, raw.serviceType, raw.category),
  );

  const vehicle = toTrimmedString(
    firstDefined(
      raw.vehicle,
      raw.vehicleName,
      raw.vehicleId,
      raw.vehicle_id,
      raw.vehicleLabel,
      raw.vehicleDescription,
      raw.car,
      raw.unit,
    ),
  );

  const rideNotes = toNotesString(
    firstDefined(
      raw.rideNotes,
      raw.notes,
      raw.note,
      raw.messages,
      raw.description,
    ),
  );

  const status =
    toTrimmedString(firstDefined(raw.status, raw.state, raw.queueStatus)) ||
    "queued";

  const pickupTimeMs = toMillis(pickupTime);
  const createdAtMs = toMillis(createdAt);
  const updatedAtMs = toMillis(updatedAt);
  const claimedAtMs = toMillis(claimedAt);

  return {
    ...raw,
    id: id ?? null,
    tripId: tripId ?? null,
    pickupTime,
    pickupTimeMs,
    rideType,
    vehicle,
    status,
    rideDuration,
    rideNotes,
    createdAt,
    createdAtMs,
    updatedAt,
    updatedAtMs,
    claimedAt,
    claimedAtMs,
    claimedBy,
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
