/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState } from "react";
import { Paper, Box } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";

import { dayjs } from "@/utils/time";
import { formatTz } from "@/utils/timeSafe";
import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";

import useWeeklySummary from "../../hooks/useWeeklySummary";

export default function WeeklySummaryTab() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const weeklyRows = useWeeklySummary({ weekStart: weekStart.toDate() });
  const columns = useMemo(() => {
    return [
      {
        field: "driver",
        headerName: "Driver",
        minWidth: 160,
        flex: 1,
        valueGetter: (params) => params?.row?.driver || "N/A",
      },
      {
        field: "driverEmail",
        headerName: "Driver Email",
        minWidth: 220,
        flex: 1.2,
        valueGetter: (params) => params?.row?.driverEmail || "N/A",
      },
      {
        field: "sessions",
        headerName: "Sessions",
        minWidth: 120,
        valueGetter: (params) => {
          const value = params?.row?.sessions;
          return Number.isFinite(value) ? value : "N/A";
        },
      },
      {
        field: "totalMinutes",
        headerName: "Total Minutes",
        minWidth: 140,
        valueGetter: (params) => {
          const value = params?.row?.totalMinutes;
          return Number.isFinite(value) ? value : "N/A";
        },
      },
      {
        field: "hours",
        headerName: "Total Hours",
        minWidth: 140,
        valueGetter: (params) => {
          const value = params?.row?.hours;
          return Number.isFinite(value) ? value : "N/A";
        },
      },
      {
        field: "firstStart",
        headerName: "First In",
        minWidth: 180,
        flex: 1,
        valueGetter: (params) => formatTz(params?.row?.firstStart) || "N/A",
      },
      {
        field: "lastEnd",
        headerName: "Last Out",
        minWidth: 180,
        flex: 1,
        valueGetter: (params) => formatTz(params?.row?.lastEnd) || "N/A",
      },
    ];
  }, []);

  const initialState = useMemo(
    () => ({ pagination: { paginationModel: { pageSize: 15, page: 0 } } }),
    [],
  );

  return (
    <Paper
      sx={{
        width: "100%",
        p: 1,
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        gap: 1,
      }}
    >
      <Box>
        <DatePicker
          label="Week of"
          value={weekStart}
          onChange={(v) => setWeekStart((v || dayjs()).startOf("week"))}
          slotProps={{ textField: { size: "small" } }}
        />
      </Box>
      <LrpDataGridPro
        id="admin-timelog-weekly-grid"
        rows={weeklyRows || []}
        columns={columns}
        checkboxSelection
        disableRowSelectionOnClick
        density="compact"
        initialState={initialState}
        pageSizeOptions={[15, 30, 60]}
        autoHeight={false}
        sx={{ flex: 1, minHeight: 0 }}
      />
    </Paper>
  );
}
