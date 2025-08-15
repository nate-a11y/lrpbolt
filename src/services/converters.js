import { toDateSafe, durationMs } from "../utils/ts";

export const mapTimeLog = (doc) => {
  const d = doc.data() || {};
  const start = d.startTime ?? d.start ?? null;
  const end = d.endTime ?? d.end ?? null;
  const created = d.createdAt ?? d.created ?? doc.createTime ?? null;

  const startDate = toDateSafe(start);
  const endDate = toDateSafe(end);
  const createdDate = toDateSafe(created);

  return {
    id: doc.id,
    driverEmail: d.driverEmail ?? d.driver ?? "",
    rideId: d.rideId ?? d.rideID ?? d.ride ?? "",
    vehicle: d.vehicle ?? "",
    trips: Number.isFinite(d.trips) ? d.trips : 0,
    passengers: Number.isFinite(d.passengers) ? d.passengers : 0,
    startTime: startDate,
    endTime: endDate,
    createdAt: createdDate,
    durationMs: durationMs(startDate, endDate),
  };
};

export const mapShootout = (doc) => {
  const d = doc.data() || {};
  const start = d.startTime ?? d.start ?? null;
  const end = d.endTime ?? d.end ?? null;
  const created = d.createdAt ?? d.created ?? doc.createTime ?? null;

  return {
    id: doc.id,
    driverEmail: d.driverEmail ?? d.driver ?? "",
    trips: Number.isFinite(d.trips) ? d.trips : 0,
    pax: Number.isFinite(d.passengers) ? d.passengers : 0,
    status: d.status ?? (end ? "Closed" : "Open"),
    startTime: toDateSafe(start),
    endTime: toDateSafe(end),
    createdAt: toDateSafe(created),
    durationMs: durationMs(start, end),
  };
};
