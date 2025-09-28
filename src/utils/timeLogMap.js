import { toDayjs } from "@/utils/time";

export function getStartTs(row) {
  return row?.startTime ?? row?.clockIn ?? row?.loggedAt ?? null;
}

export function getEndTs(row) {
  return row?.endTime ?? row?.clockOut ?? null;
}

// In your data, driverId is actually the driver's display name
export function getDriverName(row) {
  return row?.driverName ?? row?.driverId ?? row?.driver ?? "N/A";
}

export function getDriverEmail(row) {
  return row?.driverEmail ?? row?.userEmail ?? row?.email ?? "N/A";
}

export function getRideId(row) {
  return row?.rideId ?? row?.rideID ?? row?.ride ?? "N/A";
}

export function getRowId(row) {
  return row?.id ?? row?.docId ?? row?._id ?? null;
}

export function pickTimes(row) {
  const start = getStartTs(row);
  const end = getEndTs(row);
  return {
    start,
    end,
    startDayjs: toDayjs(start),
    endDayjs: toDayjs(end),
  };
}
