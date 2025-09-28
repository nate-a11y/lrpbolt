/* Proprietary and confidential. See LICENSE. */
import { formatDateTime, safeDuration } from "@/utils/time";
import { durationMinutes, timestampSortComparator } from "@/utils/timeUtils.js";

function resolveDriverName(row = {}) {
  const rawName =
    row?.driverName || row?.driver || row?.displayName || row?.name || "";
  if (rawName) return rawName;
  const email = row?.driverEmail || row?.userEmail || "";
  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0] || "N/A";
  }
  return email || "N/A";
}

function resolveDriverEmail(row = {}) {
  return row?.driverEmail || row?.userEmail || "N/A";
}

function resolveRideId(row = {}) {
  if (row?.rideId) return row.rideId;
  if (row?.mode === "N/A") return "Non-Ride Task";
  if (row?.mode === "MULTI") return "Multi Ride";
  return "N/A";
}

export function buildTimeLogColumns() {
  return [
    {
      field: "driverName",
      headerName: "Driver",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (params) => resolveDriverName(params?.row),
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 220,
      flex: 1,
      valueGetter: (params) => resolveDriverEmail(params?.row),
    },
    {
      field: "rideId",
      headerName: "Ride ID",
      minWidth: 140,
      flex: 0.7,
      valueGetter: (params) => resolveRideId(params?.row),
    },
    {
      field: "startTime",
      headerName: "Clock In",
      minWidth: 180,
      flex: 1,
      valueFormatter: (params) => formatDateTime(params?.value),
      sortComparator: (_v1, _v2, cellParams1, cellParams2) =>
        timestampSortComparator(
          cellParams1?.row?.startTime,
          cellParams2?.row?.startTime,
        ),
    },
    {
      field: "endTime",
      headerName: "Clock Out",
      minWidth: 180,
      flex: 1,
      valueFormatter: (params) => formatDateTime(params?.value),
      sortComparator: (_v1, _v2, cellParams1, cellParams2) =>
        timestampSortComparator(
          cellParams1?.row?.endTime,
          cellParams2?.row?.endTime,
        ),
    },
    {
      field: "duration",
      headerName: "Duration",
      minWidth: 140,
      flex: 0.7,
      valueGetter: (params) =>
        safeDuration(params?.row?.startTime, params?.row?.endTime),
      sortComparator: (_v1, _v2, cellParams1, cellParams2) => {
        const first = durationMinutes(
          cellParams1?.row?.startTime,
          cellParams1?.row?.endTime,
        );
        const second = durationMinutes(
          cellParams2?.row?.startTime,
          cellParams2?.row?.endTime,
        );
        if (first == null && second == null) return 0;
        if (first == null) return -1;
        if (second == null) return 1;
        return first - second;
      },
    },
  ];
}
