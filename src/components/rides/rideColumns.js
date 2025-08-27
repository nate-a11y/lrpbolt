import { fmtDateTime, minutesToHMM } from "../../utils/timeUtils";

export const rideColumns = [
  {
    field: "rideId",
    headerName: "Ride ID",
    minWidth: 120,
    flex: 0.8,
    valueGetter: (p) => p.row?.rideId || p.row?.tripId || "",
  },
  { field: "vehicle", headerName: "Vehicle", minWidth: 140, flex: 0.9 },
  { field: "rideType", headerName: "Type", minWidth: 110 },
  {
    field: "pickupTime",
    headerName: "Pickup",
    minWidth: 180,
    flex: 1,
    valueFormatter: (p) => (p?.value ? fmtDateTime(p.value) : ""),
  },
  {
    field: "durationMins",
    headerName: "Duration",
    minWidth: 110,
    valueFormatter: (p) => (p?.value != null ? minutesToHMM(p.value) : ""),
  },
  {
    field: "notes",
    headerName: "Notes",
    flex: 1.2,
    minWidth: 160,
    valueGetter: (p) => p.row?.notes || p.row?.note || "",
  },
];
