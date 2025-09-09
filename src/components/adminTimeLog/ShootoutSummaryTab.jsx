/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo } from "react";
import { Paper } from "@mui/material";

import { formatTz } from "@/utils/timeSafe";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import { subscribeShootoutStats } from "../../hooks/firestore";
import { enrichDriverNames } from "../../services/normalizers";

export default function ShootoutSummaryTab() {
  const [rows, setRows] = useState([]);
  const overrides = useMemo(
    () => ({
      firstStart: { valueGetter: (_, row) => formatTz(row?.firstStart) },
      lastEnd: { valueGetter: (_, row) => formatTz(row?.lastEnd) },
    }),
    [],
  );

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      async (stats) => {
        const map = new Map();
        (stats || []).forEach((s) => {
          const key = `${s.driverEmail || ""}|${s.vehicle || ""}`;
          const start = s.startTime;
          const end = s.endTime;
          const mins =
            start && end
              ? Math.round((end.toDate() - start.toDate()) / 60000)
              : 0;
          const prev = map.get(key) || {
            id: key,
            driverEmail: s.driverEmail || "",
            driver: s.driverEmail || "",
            vehicle: s.vehicle || "",
            sessions: 0,
            trips: 0,
            passengers: 0,
            totalMinutes: 0,
            firstStart: null,
            lastEnd: null,
          };
          const firstStart =
            !prev.firstStart ||
            (start && start.seconds < prev.firstStart.seconds)
              ? start
              : prev.firstStart;
          const lastEnd =
            !prev.lastEnd || (end && end.seconds > prev.lastEnd.seconds)
              ? end
              : prev.lastEnd;
          const totalMinutes = prev.totalMinutes + mins;
          map.set(key, {
            id: key,
            driverEmail: s.driverEmail || "",
            driver: s.driverEmail || "",
            vehicle: s.vehicle || "",
            sessions: prev.sessions + 1,
            trips: prev.trips + (s.trips || 0),
            passengers: prev.passengers + (s.passengers || 0),
            totalMinutes,
            hours: totalMinutes / 60,
            firstStart,
            lastEnd,
          });
        });
        const arr = Array.from(map.values());
        const withNames = await enrichDriverNames(arr);
        setRows(withNames);
      },
      (e) => console.error(e),
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  return (
    <Paper sx={{ width: "100%" }}>
      <SmartAutoGrid
        rows={rows || []}
        headerMap={{
          driver: "Driver",
          driverEmail: "Driver Email",
          vehicle: "Vehicle",
          sessions: "Sessions",
          trips: "Trips",
          passengers: "PAX",
          totalMinutes: "Minutes",
          hours: "Hours",
          firstStart: "First Start",
          lastEnd: "Last End",
          id: "id",
        }}
        order={[
          "driver",
          "driverEmail",
          "vehicle",
          "sessions",
          "trips",
          "passengers",
          "totalMinutes",
          "hours",
          "firstStart",
          "lastEnd",
          "id",
        ]}
        forceHide={["id"]}
        overrides={overrides}
        showToolbar
      />
    </Paper>
  );
}
