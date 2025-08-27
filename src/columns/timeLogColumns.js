/* Proprietary and confidential. See LICENSE. */
// src/columns/timeLogColumns.js
import { formatDateTime, minutesBetween, safeString, fmtMinutesHuman } from "../utils/timeUtils.js";

/**
 * timeLogs doc shape (from rules + screenshots):
 * driverEmail (string)
 * driver (string)
 * rideId (string)
 * startTime (timestamp)
 * endTime (timestamp|null)
 * duration (number)            // sometimes present; compute if missing
 * loggedAt (timestamp)
 * note (string|null)
 */

export function timeLogColumns() {
  return [
    {
      field: "driver",
      headerName: "Driver",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => safeString(p?.row?.driver ?? p?.row?.driverName),
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 220,
      flex: 1,
      valueGetter: (p) => safeString(p?.row?.driverEmail),
    },
    {
      field: "rideId",
      headerName: "Ride ID",
      minWidth: 120,
      flex: 0.5,
      valueGetter: (p) => safeString(p?.row?.rideId),
    },
    {
      field: "startTime",
      headerName: "Clock In",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(p?.row?.startTime),
      sortComparator: (v1, v2, p1, p2) => {
        const a = p1?.row?.startTime?.seconds ?? 0;
        const b = p2?.row?.startTime?.seconds ?? 0;
        return a - b;
      },
    },
    {
      field: "endTime",
      headerName: "Clock Out",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(p?.row?.endTime),
      sortComparator: (v1, v2, p1, p2) => {
        const a = p1?.row?.endTime?.seconds ?? -1;
        const b = p2?.row?.endTime?.seconds ?? -1;
        return a - b;
      },
    },
    {
      field: "duration",
      headerName: "Duration",
      minWidth: 130,
      flex: 0.6,
      valueGetter: (p) => {
        const explicit = p?.row?.duration;
        if (Number.isFinite(explicit)) return fmtMinutesHuman(explicit);
        const computed = minutesBetween(p?.row?.startTime, p?.row?.endTime);
        return fmtMinutesHuman(computed);
      },
      sortComparator: (v1, v2, p1, p2) => {
        const a = Number.isFinite(p1?.row?.duration)
          ? p1.row.duration
          : minutesBetween(p1?.row?.startTime, p1?.row?.endTime) ?? -1;
        const b = Number.isFinite(p2?.row?.duration)
          ? p2.row.duration
          : minutesBetween(p2?.row?.startTime, p2?.row?.endTime) ?? -1;
        return a - b;
      },
    },
    {
      field: "loggedAt",
      headerName: "Logged At",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(p?.row?.loggedAt),
    },
    {
      field: "note",
      headerName: "Note",
      minWidth: 240,
      flex: 1.2,
      valueGetter: (p) => safeString(p?.row?.note, ""),
    },
  ];
}
