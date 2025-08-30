/* Proprietary and confidential. See LICENSE. */
import React, { useMemo } from "react";

import { formatTz } from "@/utils/timeSafe";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import ResponsiveScrollBox from "../datagrid/ResponsiveScrollBox.jsx";
import useWeeklySummary from "../../hooks/useWeeklySummary";

export default function WeeklySummaryTab() {
  const weeklyRows = useWeeklySummary();
  const overrides = useMemo(
    () => ({
      firstStart: { valueGetter: (p) => formatTz(p?.row?.firstStart) },
      lastEnd: { valueGetter: (p) => formatTz(p?.row?.lastEnd) },
    }),
    [],
  );

  return (
    <ResponsiveScrollBox>
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
      />
    </ResponsiveScrollBox>
  );
}
