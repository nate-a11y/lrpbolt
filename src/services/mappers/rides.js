export function normalizeRide(docSnap) {
  // Accept either a docSnap or a plain object (for tests)
  const raw =
    typeof docSnap?.data === "function" ? docSnap.data() || {} : docSnap || {};
  const id = docSnap?.id || raw.id || raw.docId || null;

  // ---- Trip ID aliases ----
  // canonical: tripId (string)
  const tripId =
    raw.tripId ?? raw.tripID ?? raw.rideId ?? raw.trip ?? raw.ticketId ?? null;

  // ---- Pickup time aliases ----
  // canonical: pickupTime (Firestore Timestamp | ISO)
  const pickupTime =
    raw.pickupTime ?? raw.pickupAt ?? raw.startAt ?? raw.pickup ?? null;

  // ---- Type / Vehicle / Status / Notes ----
  const rideType = raw.rideType ?? raw.type ?? raw.serviceType ?? null;

  const vehicle = raw.vehicle ?? raw.vehicleId ?? raw.car ?? raw.unit ?? null;

  const status = raw.status ?? raw.state ?? raw.queueStatus ?? "queued";

  const rideDuration = raw.rideDuration ?? raw.duration ?? null;

  const rideNotes = raw.rideNotes ?? raw.notes ?? null;

  // Keep everything, but place canonical fields up front for grids/forms.
  return {
    id,
    tripId,
    pickupTime,
    rideType,
    vehicle,
    status,
    rideDuration,
    rideNotes,
    ...raw,
  };
}

export function normalizeRideArray(qs) {
  const docs = qs?.docs || [];
  return docs.map((d) => normalizeRide(d));
}
