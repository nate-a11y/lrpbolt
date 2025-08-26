import React, { useEffect, useMemo, useState } from "react";
import { DataGrid } from "@mui/x-data-grid-pro";
import PageContainer from "./PageContainer.jsx";
import { subscribeTimeLogs, subscribeShootoutStats } from "../hooks/api";
import {
  timeLogColumns,
  shootoutColumns,
  shootoutSummaryColumns,
} from "./adminLogs/gridColumns";

export default function AdminTimeLog() {
  const [timeLogs, setTimeLogs] = useState([]);
  const [shootout, setShootout] = useState([]);

  useEffect(() => {
    const unsub = subscribeTimeLogs(setTimeLogs, console.error);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeShootoutStats(setShootout, console.error);
    return () => unsub();
  }, []);

  const summary = useMemo(() => {
    const m = new Map();
    for (const r of shootout) {
      const key = r.driver || r.driverEmail || r.id;
      const cur = m.get(key) || {
        id: key,
        driver: key,
        sessions: 0,
        trips: 0,
        passengers: 0,
        durationMins: 0,
      };
      cur.sessions += 1;
      if (r.trips != null) cur.trips += r.trips;
      if (r.passengers != null) cur.passengers += r.passengers;
      if (r.durationMins != null) cur.durationMins += r.durationMins;
      m.set(key, cur);
    }
    return Array.from(m.values());
  }, [shootout]);

  return (
    <PageContainer title="Admin Logs">
      <DataGrid
        rows={timeLogs}
        columns={timeLogColumns}
        getRowId={(r) => r.id}
        density="comfortable"
        autoHeight
      />
      <DataGrid
        rows={shootout}
        columns={shootoutColumns}
        getRowId={(r) => r.id}
        density="comfortable"
        autoHeight
      />
      <DataGrid
        rows={summary}
        columns={shootoutSummaryColumns}
        getRowId={(r) => r.id}
        density="comfortable"
        autoHeight
      />
    </PageContainer>
  );
}
