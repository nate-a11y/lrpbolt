/* Proprietary and confidential. See LICENSE. */
import React from "react";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import useWeeklySummary from "../../hooks/useWeeklySummary";

export default function WeeklySummaryTab() {
  const weeklyRows = useWeeklySummary();

  return (
    <SmartAutoGrid
      rows={weeklyRows}
      headerMap={{
        driver: "Driver",
        driverEmail: "Driver Email",
        sessions: "Sessions",
        totalMinutes: "Total Minutes",
        hours: "Total Hours",
        firstStart: "First In",
        lastEnd: "Last Out",
      }}
      order={["driver","driverEmail","sessions","totalMinutes","hours","firstStart","lastEnd"]}
    />
  );
}
