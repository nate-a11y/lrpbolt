/* Proprietary and confidential. See LICENSE. */
import dayjs, { toDayjs as toDayjsCore } from "@/utils/dayjsSetup.js";

export function toZ(v, tz) {
  const zone = tz || dayjs.tz?.guess?.();
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return toDayjsCore(v.toDate(), zone);
    if (v?.dateTime) return toDayjsCore(v.dateTime, zone);
    if (v?.date) return toDayjsCore(`${v.date}T00:00:00`, zone);
    return toDayjsCore(v, zone);
  } catch {
    return null;
  }
}

/** Normalize many schemas into { id, vehicleId, title, driverName, start, end } */
export function normalizeEvent(raw, tz) {
  if (!raw) return null;

  const id =
    raw.id ||
    raw.eventId ||
    raw.uid ||
    raw._id ||
    raw.docId ||
    String(Math.random()).slice(2);

  // vehicle from explicit fields, extendedProperties, or parse from title
  const titleSrc = raw.title || raw.summary || raw.name || "";
  let vehicleId =
    raw.vehicleId ||
    raw.vehicle ||
    raw.vehicle_id ||
    raw?.extendedProperties?.private?.vehicleId ||
    raw?.extendedProperties?.shared?.vehicleId ||
    null;
  if (!vehicleId) {
    const m = String(titleSrc).match(
      /(LRP[A-Za-z0-9]+|Limo Bus|Sprinter|LRPBus)/i,
    );
    vehicleId = m ? m[0] : "unknown";
  }

  const start =
    toZ(raw.startTime, tz) ||
    toZ(raw.start, tz) ||
    toZ(raw.begin, tz) ||
    toZ(raw.from, tz);
  const end =
    toZ(raw.endTime, tz) ||
    toZ(raw.end, tz) ||
    toZ(raw.finish, tz) ||
    toZ(raw.to, tz);

  if (!start || !end) return null;

  const driverName = raw.driverName || raw.driver || raw.assignedTo || null;
  const title = titleSrc || "Trip";

  return { id, vehicleId, title, driverName, start, end, _raw: raw };
}

/** Union meta from explicit vehicles plus discovered vehicle IDs in events */
export function buildVehicleMeta(vehicles = [], events = []) {
  const map = new Map();
  vehicles.forEach((v) => {
    if (!v?.id) return;
    map.set(v.id, {
      id: v.id,
      label: v.label || v.name || v.id,
      shortLabel: v.shortLabel || v.code || v.id,
    });
  });
  events.forEach((e) => {
    const id = e.vehicleId || "unknown";
    if (!map.has(id)) map.set(id, { id, label: id, shortLabel: id });
  });
  return map;
}

/** Greedy lane packing to avoid overlap; returns Array<Array<Event>> */
export function packLanes(events) {
  const lanes = [];
  const sorted = [...events].sort(
    (a, b) => a.start.valueOf() - b.start.valueOf(),
  );
  sorted.forEach((ev) => {
    let placed = false;
    for (let i = 0; i < lanes.length; i += 1) {
      const last = lanes[i][lanes[i].length - 1];
      if (!last || last.end.isSame(ev.start) || last.end.isBefore(ev.start)) {
        lanes[i].push(ev);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([ev]);
  });
  return lanes;
}
