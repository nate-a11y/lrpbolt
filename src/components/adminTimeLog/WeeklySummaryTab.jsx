/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState } from "react";
import { Paper, Box, CircularProgress } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";

import { dayjs } from "@/utils/time";
import { formatTz } from "@/utils/timeSafe";
import UniversalDataGrid from "@/components/datagrid/UniversalDataGrid";
import { EmptyState, ErrorState } from "@/components/feedback/SectionState.jsx";

import useWeeklySummary from "../../hooks/useWeeklySummary";

export default function WeeklySummaryTab() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    rows: weeklyRows,
    loading,
    error,
  } = useWeeklySummary({
    weekStart: weekStart.toDate(),
    refreshKey,
  });
  // MUI DataGrid Pro v7 API: valueGetter signature is (value, row, column, apiRef)
  const columns = useMemo(() => {
    return [
      {
        field: "driver",
        headerName: "Driver",
        minWidth: 160,
        flex: 1,
        valueGetter: (value, row) => row?.driver || "N/A",
      },
      {
        field: "driverEmail",
        headerName: "Driver Email",
        minWidth: 220,
        flex: 1.2,
        valueGetter: (value, row) => row?.driverEmail || "N/A",
      },
      {
        field: "sessions",
        headerName: "Sessions",
        minWidth: 120,
        valueGetter: (value, row) => {
          const val = row?.sessions;
          return Number.isFinite(val) ? val : "N/A";
        },
      },
      {
        field: "totalMinutes",
        headerName: "Total Minutes",
        minWidth: 140,
        valueGetter: (value, row) => {
          const val = row?.totalMinutes;
          return Number.isFinite(val) ? val : "N/A";
        },
      },
      {
        field: "hours",
        headerName: "Total Hours",
        minWidth: 140,
        valueGetter: (value, row) => {
          const val = row?.hours;
          return Number.isFinite(val) ? val : "N/A";
        },
      },
      {
        field: "firstStart",
        headerName: "First In",
        minWidth: 180,
        flex: 1,
        valueGetter: (value, row) => formatTz(row?.firstStart) || "N/A",
      },
      {
        field: "lastEnd",
        headerName: "Last Out",
        minWidth: 180,
        flex: 1,
        valueGetter: (value, row) => formatTz(row?.lastEnd) || "N/A",
      },
    ];
  }, []);

  const initialState = useMemo(
    () => ({ pagination: { paginationModel: { pageSize: 15, page: 0 } } }),
    [],
  );

  if (loading) {
    return (
      <Paper
        sx={{
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <CircularProgress size={24} />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper
        sx={{
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <ErrorState
          description={error}
          onAction={() => setRefreshKey((key) => key + 1)}
        />
      </Paper>
    );
  }

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
      {weeklyRows?.length ? (
        <UniversalDataGrid
          id="admin-timelog-weekly"
          id="admin-timelog-weekly-grid"
          rows={weeklyRows}
          columns={columns}
          checkboxSelection
          disableRowSelectionOnClick
          density="compact"
          initialState={initialState}
          pageSizeOptions={[15, 30, 60]}
          autoHeight={false}
          sx={{ flex: 1, minHeight: 0 }}
        />
      ) : (
        <EmptyState
          title="No weekly summary"
          description="Clock-in data will roll into this summary once sessions are logged."
        />
      )}
    </Paper>
  );
}
