/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState } from "react";
import { Paper, Box } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";

import { dayjs } from "@/utils/time";
import { formatTz } from "@/utils/timeSafe";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import useWeeklySummary from "../../hooks/useWeeklySummary";

export default function WeeklySummaryTab() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const weeklyRows = useWeeklySummary({ weekStart: weekStart.toDate() });
  const overrides = useMemo(
    () => ({
      firstStart: { valueGetter: (p) => formatTz(p?.row?.firstStart) },
      lastEnd: { valueGetter: (p) => formatTz(p?.row?.lastEnd) },
    }),
    [],
  );

  return (
    <Paper
      sx={{ width: "100%", p: 1, display: "flex", flexDirection: "column" }}
    >
      <Box sx={{ mb: 1 }}>
        <DatePicker
          label="Week of"
          value={weekStart}
          onChange={(v) => setWeekStart((v || dayjs()).startOf("week"))}
          slotProps={{ textField: { size: "small" } }}
        />
      </Box>
      <SmartAutoGrid
        rows={weeklyRows || []}
        headerMap={{
          driver: "Driver",
          driverEmail: "Driver Email",
          sessions: "Sessions",
          totalMinutes: "Total Minutes",
          hours: "Total Hours",
          firstStart: "First In",
          lastEnd: "Last Out",
        }}
        order={[
          "driver",
          "driverEmail",
          "sessions",
          "totalMinutes",
          "hours",
          "firstStart",
          "lastEnd",
        ]}
        overrides={overrides}
        checkboxSelection
        disableRowSelectionOnClick
      />
    </Paper>
  );
}
