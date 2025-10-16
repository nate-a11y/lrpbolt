/* Proprietary and confidential. See LICENSE. */
import dayjs, { toDayjs as toDayjsCore } from "@/utils/dayjsSetup.js";
import logError from "@/utils/logError.js";

export function toDayjs(v, tz) {
  try {
    const zone = tz || dayjs.tz?.guess?.();
    if (!v) return null;
    if (typeof v?.toDate === "function") return toDayjsCore(v.toDate(), zone);
    if (v?.dateTime) return toDayjsCore(v.dateTime, zone);
    if (v?.date) return toDayjsCore(`${v.date}T00:00:00`, zone);
    return toDayjsCore(v, zone);
  } catch (err) {
    logError(err, { area: "scheduleUtils", action: "toDayjs" });
    return null;
  }
}

/** Normalize multiple schemas into { id, vehicleId, title, driverName, start:dayjs, end:dayjs } */
export function normalizeRide(raw, tz) {
  if (!raw) return null;
  const zone = tz || dayjs.tz?.guess?.();

  // id
  const id =
    raw.id ||
    raw.eventId ||
    raw.uid ||
    raw._id ||
    String(Math.random()).slice(2);

  // vehicleId (priority: explicit fields, extendedProperties, parse from title)
  let vehicleId =
    raw.vehicleId ||
    raw.vehicle ||
    raw.vehicle_id ||
    raw.vehicleCode ||
    raw?.extendedProperties?.private?.vehicleId ||
    raw?.extendedProperties?.shared?.vehicleId ||
    null;

  const titleSource = raw.title || raw.summary || raw.name || "";
  if (!vehicleId) {
    const match = titleSource.match(
      /(LRP[A-Za-z0-9]+|Limo Bus|Sprinter|LRPBus)/i,
    );
    vehicleId = match ? match[0] : null;
  }

  // title + driver
  const title = titleSource || "Trip";
  let driverName = raw.driverName || raw.driver || raw.assignedTo || null;
  if (!driverName) {
    // parse " - Michael" or "with <vehicle> - Michael"
    const m = title.match(/-\s*([A-Za-z]+)$/);
    if (m) driverName = m[1];
  }

  // times (support Firestore, gCal, legacy, ms)
  const start =
    toDayjs(raw.startTime, zone) ||
    toDayjs(raw.start, zone) ||
    toDayjs(raw.begin, zone) ||
    toDayjs(raw.from, zone);
  const end =
    toDayjs(raw.endTime, zone) ||
    toDayjs(raw.end, zone) ||
    toDayjs(raw.finish, zone) ||
    toDayjs(raw.to, zone);

  if (!start || !end) return null;

  return {
    id,
    vehicleId: vehicleId || "unknown",
    title,
    driverName,
    start,
    end,
    _raw: raw,
  };
}

/** Greedy lane packing to avoid visual overlap; lanes = Ride[][] */
export function packLanes(rides) {
  const lanes = [];
  const sorted = [...rides].sort(
    (a, b) => a.start.valueOf() - b.start.valueOf(),
  );
  sorted.forEach((ride) => {
    let placed = false;
    for (let i = 0; i < lanes.length; i += 1) {
      const last = lanes[i][lanes[i].length - 1];
      if (
        !last ||
        last.end.isSame(ride.start) ||
        last.end.isBefore(ride.start)
      ) {
        lanes[i].push(ride);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([ride]);
  });
  return lanes;
}

/** gaps smaller than N minutes */
export function computeTightGaps(rides, minutes = 20) {
  if (!rides || rides.length < 2) return 0;
  let count = 0;
  for (let i = 0; i < rides.length - 1; i += 1) {
    const gap = rides[i + 1].start.diff(rides[i].end, "minute");
    if (gap >= 0 && gap < minutes) count += 1;
  }
  return count;
}

export function minutesBetweenSafe(start, end) {
  try {
    if (!start || !end) return 0;
    return Math.max(0, end.diff(start, "minute"));
  } catch (err) {
    logError(err);
    return 0;
  }
}

export function formatRangeLocal(start, end, tz) {
  try {
    if (!start || !end) return "N/A";
    const s = start.tz(tz || dayjs.tz.guess());
    const e = end.tz(tz || dayjs.tz.guess());
    const sameDay = s.isSame(e, "day");
    return sameDay
      ? `${s.format("h:mm a")} – ${e.format("h:mm a")}`
      : `${s.format("MMM D, h:mm a")} – ${e.format("MMM D, h:mm a")}`;
  } catch (err) {
    logError(err);
    return "N/A";
  }
}

/** Merge explicit vehicles with those discovered in rides; return Map(id -> {id,label,shortLabel}). */
export function collectVehicleMeta(vehicles = [], rides = []) {
  const map = new Map();
  vehicles.forEach((v) => {
    if (!v?.id) return;
    map.set(v.id, {
      id: v.id,
      label: v.label || v.name || v.id,
      shortLabel: v.shortLabel || v.short || v.code,
    });
  });
  rides.forEach((r) => {
    const id = r.vehicleId || "unknown";
    if (!map.has(id)) {
      map.set(id, { id, label: id, shortLabel: id });
    }
  });
  return map;
}

/** CSV export using normalized rides */
export function exportRidesCsv({
  rides = [],
  tz: _tz,
  filename = "lrp-rides.csv",
}) {
  const rows = [
    [
      "Ride ID",
      "Vehicle ID",
      "Title",
      "Driver",
      "Start",
      "End",
      "Duration (min)",
    ],
    ...rides.map((r) => [
      r.id ?? "",
      r.vehicleId ?? "",
      r.title ?? "",
      r.driverName ?? "",
      r.start ? r.start.format() : "",
      r.end ? r.end.format() : "",
      minutesBetweenSafe(r.start, r.end),
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
