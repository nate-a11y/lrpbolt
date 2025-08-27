/* Proprietary and confidential. See LICENSE. */
// src/columns/shootoutColumns.js
import { formatDateTime, safeNumber, safeString, minutesBetween, fmtMinutesHuman } from "../utils/timeUtils";

/**
 * shootoutStats doc shape:
 * driverEmail (string)
 * vehicle (string)
 * startTime (timestamp)
 * endTime (timestamp|null)
 * trips (number)
 * passengers (number)
 * createdAt (timestamp)
 */

export function shootoutColumns() {
  return [
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 220,
      flex: 1,
      valueGetter: (p) => safeString(p?.row?.driverEmail),
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 160,
      flex: 0.8,
      valueGetter: (p) => safeString(p?.row?.vehicle),
    },
    {
      field: "startTime",
      headerName: "Start",
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
      headerName: "End",
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
      field: "sessionLength",
      headerName: "Session",
      minWidth: 120,
      flex: 0.6,
      valueGetter: (p) => fmtMinutesHuman(minutesBetween(p?.row?.startTime, p?.row?.endTime)),
      sortComparator: (v1, v2, p1, p2) => {
        const a = minutesBetween(p1?.row?.startTime, p1?.row?.endTime) ?? -1;
        const b = minutesBetween(p2?.row?.startTime, p2?.row?.endTime) ?? -1;
        return a - b;
      },
    },
    {
      field: "trips",
      headerName: "Trips",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: (p) => safeNumber(p?.row?.trips, 0),
    },
    {
      field: "passengers",
      headerName: "PAX",
      minWidth: 110,
      flex: 0.5,
      type: "number",
      valueGetter: (p) => safeNumber(p?.row?.passengers, 0),
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      flex: 0.8,
      valueGetter: (p) => formatDateTime(p?.row?.createdAt),
    },
  ];
}
