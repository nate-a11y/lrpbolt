import { Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { dayjs, toDayjs } from "@/utils/time";

// --- null-safe helpers ---
const val = (obj, keys) => {
  const r = obj || {};
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
};
// --------------------------

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
  const r = row || {};
  const start = val(r, ["startTime", "clockIn", "loggedAt"]);
  const end = val(r, ["endTime", "clockOut"]);
  return !!start && !end;
}

export function buildTimeLogColumns() {
  return [
    {
      field: "driverName",
      headerName: "Driver",
      minWidth: 140,
      flex: 0.8,
      renderCell: (params) =>
        val(params?.row, ["driverName", "driverId", "driver"]) ?? "N/A",
      valueGetter: (value, row) =>
        val(row, ["driverName", "driverId", "driver"]) ?? "N/A",
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 200,
      flex: 1,
      renderCell: (params) =>
        val(params?.row, ["driverEmail", "userEmail", "email"]) ?? "N/A",
      valueGetter: (value, row) =>
        val(row, ["driverEmail", "userEmail", "email"]) ?? "N/A",
    },
    {
      field: "rideId",
      headerName: "Ride ID",
      minWidth: 120,
      renderCell: (params) =>
        val(params?.row, ["rideId", "rideID", "ride"]) ?? "N/A",
      valueGetter: (value, row) =>
        val(row, ["rideId", "rideID", "ride"]) ?? "N/A",
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 110,
      sortable: false,
      renderCell: (params) =>
        isActive(params?.row) ? (
          <Chip
            size="small"
            label="Active"
            sx={{
              bgcolor: (t) => alpha(t.palette.primary.main, 0.18),
              color: (t) => t.palette.primary.main,
              border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
            }}
          />
        ) : (
          <Chip
            size="small"
            label="Completed"
            sx={{ bgcolor: "action.selected", color: "text.primary" }}
          />
        ),
      valueGetter: (value, row) => (isActive(row) ? "Active" : "Completed"),
    },
    {
      field: "clockIn",
      headerName: "Clock In",
      minWidth: 180,
      renderCell: (params) =>
        fmt(val(params?.row, ["startTime", "clockIn", "loggedAt"])),
      valueGetter: (value, row) =>
        val(row, ["startTime", "clockIn", "loggedAt"]) ?? null,
    },
    {
      field: "clockOut",
      headerName: "Clock Out",
      minWidth: 180,
      renderCell: (params) => fmtOut(val(params?.row, ["endTime", "clockOut"])),
      valueGetter: (value, row) => val(row, ["endTime", "clockOut"]) ?? null,
    },
    {
      field: "duration",
      headerName: "Duration",
      minWidth: 120,
      renderCell: (params) => {
        const r = params?.row;
        return duration(
          val(r, ["startTime", "clockIn", "loggedAt"]),
          val(r, ["endTime", "clockOut"]),
        );
      },
      valueGetter: (value, row) => {
        // Calculate raw duration in minutes for sorting
        const start = toDayjs(val(row, ["startTime", "clockIn", "loggedAt"]));
        const end = val(row, ["endTime", "clockOut"])
          ? toDayjs(val(row, ["endTime", "clockOut"]))
          : dayjs();
        if (!start || !end || end.isBefore(start)) return null;
        return end.diff(start, "minute"); // Return raw minutes for sorting
      },
    },
  ];
}
