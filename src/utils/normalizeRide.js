/**
 * Grid-only normalizer for ride rows.
 * - Resolves legacy aliases (tripID/rideId/trip, pickupAt/pickup)
 * - Converts Firestore Timestamp -> Date
 * - Returns primitives so the grid never renders [object Object]
 * - Leaves raw document on _raw (modal uses its own path; do not import this there)
 */

function toDate(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  } catch (error) {
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.warn("[normalizeRide] toDate failed", error);
    }
  }
  if (v instanceof Date) return isNaN(v) ? null : v;
  const n = typeof v === "number" ? v : Date.parse(v);
  const d = new Date(n);
  return isNaN(d.getTime()) ? null : d;
}

function str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function strIfPrimitive(v) {
  if (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "bigint" ||
    typeof v === "boolean"
  ) {
    return str(v);
  }
  return null;
}

function toId(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = toId(item);
      if (id) return id;
    }
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint"
  ) {
    return str(value);
  }
  if (typeof value === "object") {
    return (
      strIfPrimitive(value.id) ||
      strIfPrimitive(value.uid) ||
      strIfPrimitive(value.userId) ||
      strIfPrimitive(value.user_id) ||
      strIfPrimitive(value.driverId) ||
      strIfPrimitive(value.driver_id) ||
      strIfPrimitive(value.email) ||
      strIfPrimitive(value.phone) ||
      null
    );
  }
  return null;
}

function toName(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = toName(item);
      if (name) return name;
    }
    return null;
  }
  if (typeof value === "string") {
    return str(value);
  }
  if (typeof value === "object") {
    const direct =
      strIfPrimitive(value.displayName) ||
      strIfPrimitive(value.name) ||
      strIfPrimitive(value.fullName) ||
      strIfPrimitive(value.full_name) ||
      strIfPrimitive(value.driverName) ||
      strIfPrimitive(value.driver) ||
      strIfPrimitive(value.label) ||
      strIfPrimitive(value.title) ||
      strIfPrimitive(value.text) ||
      strIfPrimitive(value.value);
    if (direct) return direct;

    const first =
      strIfPrimitive(value.firstName) || strIfPrimitive(value.first_name);
    const last =
      strIfPrimitive(value.lastName) || strIfPrimitive(value.last_name);
    const combined = [first, last].filter(Boolean).join(" ").trim();
    if (combined) return combined;
  }
  return null;
}

function pickName(...values) {
  for (const value of values) {
    const name = toName(value);
    if (name) return name;
  }
  return null;
}

export function normalizeRide(docOrData) {
  const isSnap = !!docOrData && typeof docOrData.data === "function";
  const data = isSnap ? docOrData.data() || {} : docOrData || {};
  const id = isSnap ? docOrData.id || data.id : data.id || null;

  const tripId = data.tripId ?? data.tripID ?? data.rideId ?? data.trip ?? null;

  const pickupTimeRaw = data.pickupTime ?? data.pickupAt ?? data.pickup ?? null;

  const createdAtRaw = data.createdAt ?? null;
  const claimedAtRaw = data.claimedAt ?? data.ClaimedAt ?? null;

  const claimedBySource =
    data.claimedBy ??
    data.ClaimedBy ??
    data.claimed_by ??
    data.claimer ??
    data.claimed_user ??
    data.assignedTo ??
    data.assigned_to ??
    null;

  const claimedBy =
    toId(claimedBySource) ??
    strIfPrimitive(data.claimedBy) ??
    strIfPrimitive(data.ClaimedBy) ??
    strIfPrimitive(data.claimed_by) ??
    strIfPrimitive(data.claimedUserId) ??
    strIfPrimitive(data.claimed_user_id) ??
    strIfPrimitive(data.claimerId) ??
    strIfPrimitive(data.claimer_id) ??
    strIfPrimitive(data.assignedTo) ??
    strIfPrimitive(data.assigned_to) ??
    strIfPrimitive(data.assignedUserId) ??
    strIfPrimitive(data.assigned_user_id) ??
    null;

  const claimedByName =
    pickName(
      data.claimedByName,
      data.ClaimedByName,
      data.claimed_by_name,
      data.claimedByDisplayName,
      data.claimed_by_display_name,
      data.claimerName,
      data.claimer_name,
      data.claimed_user_name,
      data.assignedToName,
      data.assigned_to_name,
      claimedBySource,
    ) || null;

  return {
    id: id || null,
    tripId: str(tripId),
    pickupTime: toDate(pickupTimeRaw),
    rideDuration:
      typeof data.rideDuration === "number" ? data.rideDuration : null,
    rideType: str(data.rideType),
    vehicle: str(data.vehicle),
    rideNotes: str(data.rideNotes),
    status: str(data.status) || "queued",
    claimedBy,
    claimedByName,
    claimedAt: toDate(claimedAtRaw),
    createdAt: toDate(createdAtRaw),
    createdBy: str(data.createdBy),
    updatedAt: toDate(data.updatedAt),
    lastModifiedBy: str(data.lastModifiedBy),
    _raw: data,
  };
}

export function normalizeRideArray(items) {
  return (items || []).map(normalizeRide);
}
