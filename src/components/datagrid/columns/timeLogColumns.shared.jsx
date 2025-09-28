import { Chip } from "@mui/material";

import { dayjs, toDayjs } from "@/utils/time";

/** helpers */
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}
function fmt(ts, fmtStr = "MMM D, YYYY h:mm A") {
  const d = toDayjs(ts);
  return d ? d.tz(dayjs.tz.guess()).format(fmtStr) : "N/A";
}
function fmtOut(ts) {
  if (!ts) return "—"; // em dash while active
  const d = toDayjs(ts);
  return d ? d.tz(dayjs.tz.guess()).format("MMM D, YYYY h:mm A") : "N/A";
}
function duration(startTs, endTs) {
  const start = toDayjs(startTs);
  const end = endTs ? toDayjs(endTs) : dayjs();
  if (!start || !end || end.isBefore(start)) return "N/A";
  const mins = end.diff(start, "minute");
  if (mins < 1) return "<1 min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function isActive(row) {
  const start = pick(row, ["startTime", "clockIn", "loggedAt"]);
  const end = pick(row, ["endTime", "clockOut"]);
  return !!start && !end;
}

export function buildTimeLogColumns() {
  return [
    {
      field: "driverName",
      headerName: "Driver",
      minWidth: 140,
      flex: 0.8,
      renderCell: (p) =>
        pick(p.row, ["driverName", "driverId", "driver"]) || "N/A",
      valueGetter: (p) =>
        pick(p.row, ["driverName", "driverId", "driver"]) || "N/A",
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 200,
      flex: 1,
      renderCell: (p) =>
        pick(p.row, ["driverEmail", "userEmail", "email"]) || "N/A",
      valueGetter: (p) =>
        pick(p.row, ["driverEmail", "userEmail", "email"]) || "N/A",
    },
    {
      field: "rideId",
      headerName: "Ride ID",
      minWidth: 120,
      renderCell: (p) => pick(p.row, ["rideId", "rideID", "ride"]) || "N/A",
      valueGetter: (p) => pick(p.row, ["rideId", "rideID", "ride"]) || "N/A",
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 110,
      sortable: false,
      renderCell: (p) =>
        isActive(p.row) ? (
          <Chip
            size="small"
            label="Active"
            sx={{
              bgcolor: "rgba(76,187,23,0.18)",
              color: "#4cbb17",
              border: "1px solid rgba(76,187,23,0.35)",
            }}
          />
        ) : (
          <Chip
            size="small"
            label="Completed"
            sx={{ bgcolor: "action.selected", color: "text.primary" }}
          />
        ),
      valueGetter: (p) => (isActive(p.row) ? "Active" : "Completed"),
    },
    {
      field: "clockIn",
      headerName: "Clock In",
      minWidth: 180,
      renderCell: (p) => fmt(pick(p.row, ["startTime", "clockIn", "loggedAt"])),
      valueGetter: (p) =>
        fmt(pick(p.row, ["startTime", "clockIn", "loggedAt"])),
    },
    {
      field: "clockOut",
      headerName: "Clock Out",
      minWidth: 180,
      renderCell: (p) => fmtOut(pick(p.row, ["endTime", "clockOut"])),
      valueGetter: (p) => fmtOut(pick(p.row, ["endTime", "clockOut"])),
    },
    {
      field: "duration",
      headerName: "Duration",
      minWidth: 120,
      renderCell: (p) => {
        const start = pick(p.row, ["startTime", "clockIn", "loggedAt"]);
        const end = pick(p.row, ["endTime", "clockOut"]);
        return duration(start, end);
      },
      valueGetter: (p) => {
        const start = pick(p.row, ["startTime", "clockIn", "loggedAt"]);
        const end = pick(p.row, ["endTime", "clockOut"]);
        return duration(start, end);
      },
    },
  ];
}
