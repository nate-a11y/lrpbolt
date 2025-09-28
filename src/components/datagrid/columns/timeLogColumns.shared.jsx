import { Chip } from "@mui/material";

import {
  formatDateTime,
  safeDuration,
  isActiveRow,
  formatClockOutOrDash,
} from "@/utils/time";
import {
  getDriverName,
  getDriverEmail,
  getRideId,
  pickTimes,
} from "@/utils/timeLogMap";

export function buildTimeLogColumns() {
  return [
    {
      field: "driverName",
      headerName: "Driver",
      minWidth: 140,
      flex: 0.8,
      valueGetter: (params) => getDriverName(params?.row),
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 200,
      flex: 1,
      valueGetter: (params) => getDriverEmail(params?.row),
    },
    {
      field: "rideId",
      headerName: "Ride ID",
      minWidth: 120,
      valueGetter: (params) => getRideId(params?.row),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 110,
      sortable: false,
      valueGetter: (params) =>
        isActiveRow(params?.row) ? "Active" : "Completed",
      renderCell: (params) =>
        isActiveRow(params.row) ? (
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
    },
    {
      field: "clockIn",
      headerName: "Clock In",
      minWidth: 180,
      valueGetter: (params) => {
        const { start } = pickTimes(params?.row);
        return start ? formatDateTime(start) : "N/A";
      },
    },
    {
      field: "clockOut",
      headerName: "Clock Out",
      minWidth: 180,
      valueGetter: (params) => {
        const { end } = pickTimes(params?.row);
        return formatClockOutOrDash(end);
      },
    },
    {
      field: "duration",
      headerName: "Duration",
      minWidth: 120,
      valueGetter: (params) => {
        const { start, end } = pickTimes(params?.row);
        return safeDuration(start, end);
      },
    },
  ];
}
