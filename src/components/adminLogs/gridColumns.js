// /src/components/adminLogs/gridColumns.js
import { fmtDateTime, minutesToHMM, minutesToHoursDecimal } from "../../utils/timeUtils";

// Entries (timeLogs)
export const timeLogColumns = [
  { field: "driver", headerName: "Driver", flex: 1, minWidth: 120 },
  { field: "rideId", headerName: "Ride ID", flex: 0.7, minWidth: 120, valueGetter: (p) => p.row.rideId || "" },
  {
    field: "start",
    headerName: "Start",
    flex: 1, minWidth: 180,
    valueFormatter: (p) => fmtDateTime(p.value),
  },
  {
    field: "end",
    headerName: "End",
    flex: 1, minWidth: 180,
    valueFormatter: (p) => fmtDateTime(p.value),
  },
  {
    field: "durationMins",
    headerName: "Duration",
    flex: 0.8, minWidth: 120,
    valueFormatter: (p) => minutesToHMM(p.value),
    sortComparator: (a, b) => (a ?? 0) - (b ?? 0),
  },
  {
    field: "created",
    headerName: "Logged At",
    flex: 1, minWidth: 180,
    valueFormatter: (p) => fmtDateTime(p.value),
  },
];

// Shootout stats (detail rows)
export const shootoutColumns = [
  { field: "driver", headerName: "Driver", flex: 1, minWidth: 120 },
  { field: "vehicle", headerName: "Vehicle", flex: 1, minWidth: 140 },
  { field: "start", headerName: "Start", flex: 1, minWidth: 180, valueFormatter: (p) => fmtDateTime(p.value) },
  { field: "end", headerName: "End", flex: 1, minWidth: 180, valueFormatter: (p) => fmtDateTime(p.value) },
  { field: "durationMins", headerName: "Duration", flex: 0.8, minWidth: 120, valueFormatter: (p) => minutesToHMM(p.value) },
  { field: "trips", headerName: "Trips", width: 90 },
  { field: "passengers", headerName: "Pax", width: 90 },
  { field: "created", headerName: "Created", flex: 1, minWidth: 180, valueFormatter: (p) => fmtDateTime(p.value) },
];

// Shootout summary (per driver aggregates) – compute in component, but formatters stay null-safe:
export const shootoutSummaryColumns = [
  { field: "driver", headerName: "Driver", flex: 1, minWidth: 140 },
  { field: "sessions", headerName: "Sessions", width: 110 },
  { field: "trips", headerName: "Trips", width: 100 },
  { field: "passengers", headerName: "Passengers", width: 130 },
  {
    field: "durationMins",
    headerName: "Duration",
    width: 120,
    valueFormatter: (p) => minutesToHMM(p.value),
  },
  {
    field: "hours",
    headerName: "Hours",
    width: 100,
    valueGetter: (p) => p.row.durationMins ?? 0,
    valueFormatter: (p) => minutesToHoursDecimal(p.value),
    sortComparator: (a, b) => (a ?? 0) - (b ?? 0),
  },
];
