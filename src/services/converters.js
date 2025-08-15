import { toDateSafe, durationMs } from "../utils/ts";

export const mapTimeLog = (doc) => {
  const d = doc.data() || {};
  const start = d.startTime ?? d.start ?? null;
  const end = d.endTime ?? d.end ?? null;
  const logged = d.loggedAt ?? d.createdAt ?? d.created ?? doc.createTime ?? null;

  const startDate = toDateSafe(start);
  const endDate = toDateSafe(end);
  const loggedDate = toDateSafe(logged);

  const duration = Number.isFinite(d.duration)
    ? d.duration * 60000
    : durationMs(startDate, endDate);

  return {
    id: doc.id,
    driverEmail: d.driverEmail ?? d.driver ?? d.userEmail ?? "",
    rideId: d.rideId ?? d.rideID ?? d.ride ?? "",
    vehicle: d.vehicle ?? "",
    trips: Number.isFinite(d.trips) ? d.trips : 0,
    passengers: Number.isFinite(d.passengers) ? d.passengers : 0,
    startTime: startDate,
    endTime: endDate,
    loggedAt: loggedDate,
    durationMs: duration,
  };
};

export const mapShootout = (doc) => {
  const d = doc.data() || {};
  const start = d.startTime ?? d.start ?? null;
  const end = d.endTime ?? d.end ?? null;
  const created = d.createdAt ?? d.created ?? doc.createTime ?? null;

  const startDate = toDateSafe(start);
  const endDate = toDateSafe(end);
  const duration = Number.isFinite(d.duration)
    ? d.duration * 1000
    : durationMs(startDate, endDate);

  return {
    id: doc.id,
    driverEmail: d.driverEmail ?? d.driver ?? "",
    trips: Number.isFinite(d.trips) ? d.trips : 0,
    pax: Number.isFinite(d.passengers) ? d.passengers : 0,
    status: d.status ?? (endDate ? "Closed" : "Open"),
    startTime: startDate,
    endTime: endDate,
    createdAt: toDateSafe(created),
    durationMs: duration,
  };
};
