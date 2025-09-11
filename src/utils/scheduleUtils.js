/* Proprietary and confidential. See LICENSE. */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/** Convert Firestore Timestamp | Date | string to dayjs.tz or return null safely. */
export function toDayjs(v, tz) {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function")
      return dayjs(v.toDate()).tz(tz || dayjs.tz.guess());
    if (v instanceof Date) return dayjs(v).tz(tz || dayjs.tz.guess());
    if (typeof v === "number") return dayjs(v).tz(tz || dayjs.tz.guess());
    return dayjs(v).tz(tz || dayjs.tz.guess());
  } catch {
    return null;
  }
}

export function hasOverlap(aStart, aEnd, bStart, bEnd) {
  return aEnd.isAfter(bStart) && bEnd.isAfter(aStart);
}

/** Greedy lane packing to avoid visual overlap. Returns array of lanes, each lane is array of rides. */
export function packLanes(rides) {
  const lanes = [];
  const sorted = [...rides].sort(
    (a, b) => a.start.valueOf() - b.start.valueOf(),
  );
  sorted.forEach((ride) => {
    let placed = false;
    for (let i = 0; i < lanes.length; i += 1) {
      const last = lanes[i][lanes[i].length - 1];
      if (!last || !hasOverlap(last.start, last.end, ride.start, ride.end)) {
        lanes[i].push(ride);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([ride]);
  });
  return lanes;
}

/** Count gaps less than N minutes. */
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
  } catch {
    return 0;
  }
}

export function formatRangeLocal(start, end, tz) {
  try {
    if (!start || !end) return "N/A";
    const s = start.tz(tz || dayjs.tz.guess());
    const e = end.tz(tz || dayjs.tz.guess());
    const sameDay = s.isSame(e, "day");
    if (sameDay) return `${s.format("h:mm a")} – ${e.format("h:mm a")}`;
    return `${s.format("MMM D, h:mm a")} – ${e.format("MMM D, h:mm a")}`;
  } catch {
    return "N/A";
  }
}

/** Simple client-side CSV export (no external deps). */
export function exportRidesCsv({ rides = [], tz, filename = "lrp-rides.csv" }) {
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
    ...rides.map((r) => {
      const s = toDayjs(r.startTime, tz);
      const e = toDayjs(r.endTime, tz);
      return [
        r.id ?? "",
        r.vehicleId ?? r.vehicle ?? "",
        r.title ?? "",
        r.driverName ?? "",
        s ? s.format() : "",
        e ? e.format() : "",
        minutesBetweenSafe(s, e),
      ];
    }),
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
