export function normalizeRide(docSnap) {
  if (!docSnap) return { id: null, status: "queued" };

  const rawData =
    typeof docSnap?.data === "function" ? docSnap.data() || {} : docSnap || {};
  const data = rawData && typeof rawData === "object" ? rawData : {};

  const {
    id: dataId,
    tripId: rawTripId,
    tripID,
    pickupTime: rawPickupTime,
    pickupAt,
    rideType: rawRideType,
    type,
    vehicle: rawVehicle,
    vehicleId,
    status: rawStatus,
    state,
    ...rest
  } = data;

  const id = docSnap?.id ?? dataId ?? null;

  const tripId = rawTripId ?? tripID ?? null;
  const pickupTime = rawPickupTime ?? pickupAt ?? null;
  const rideType = rawRideType ?? type ?? null;
  const vehicle = rawVehicle ?? vehicleId ?? null;
  const status = rawStatus ?? state ?? "queued";

  return {
    id,
    tripId,
    pickupTime,
    rideType,
    vehicle,
    status,
    ...rest,
  };
}

export function normalizeRideArray(qs) {
  const docs = qs?.docs || [];
  return docs.map((d) => normalizeRide(d));
}
