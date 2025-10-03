/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo } from "react";
import { Paper } from "@mui/material";

import { formatTz } from "@/utils/timeSafe";
import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";

import { subscribeShootoutStats } from "../../hooks/firestore";
import { enrichDriverNames } from "../../services/normalizers";

export default function ShootoutSummaryTab() {
  const [rows, setRows] = useState([]);
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
        field: "vehicle",
        headerName: "Vehicle",
        minWidth: 140,
        flex: 1,
        valueGetter: (params) => params?.row?.vehicle || "N/A",
      },
      {
        field: "sessions",
        headerName: "Sessions",
        minWidth: 120,
        valueGetter: (params) => params?.row?.sessions ?? null,
      },
      {
        field: "trips",
        headerName: "Trips",
        minWidth: 120,
        valueGetter: (params) => params?.row?.trips ?? null,
      },
      {
        field: "passengers",
        headerName: "PAX",
        minWidth: 120,
        valueGetter: (params) => params?.row?.passengers ?? null,
      },
      {
        field: "totalMinutes",
        headerName: "Minutes",
        minWidth: 140,
        valueGetter: (params) => params?.row?.totalMinutes ?? null,
      },
      {
        field: "hours",
        headerName: "Hours",
        minWidth: 140,
        valueGetter: (params) => {
          const value = params?.row?.hours;
          return Number.isFinite(value)
            ? Number(value.toFixed?.(2) ?? value)
            : "N/A";
        },
      },
      {
        field: "firstStart",
        headerName: "First Start",
        minWidth: 180,
        flex: 1,
        valueGetter: (params) => formatTz(params?.row?.firstStart) || "N/A",
      },
      {
        field: "lastEnd",
        headerName: "Last End",
        minWidth: 180,
        flex: 1,
        valueGetter: (params) => formatTz(params?.row?.lastEnd) || "N/A",
      },
      {
        field: "id",
        headerName: "id",
        minWidth: 120,
        valueGetter: (params) => params?.row?.id || "N/A",
      },
    ];
  }, []);

  const initialState = useMemo(
    () => ({
      pagination: { paginationModel: { pageSize: 15, page: 0 } },
      columns: { columnVisibilityModel: { id: false } },
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
    <Paper
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <LrpDataGridPro
        id="admin-timelog-shootout-summary-grid"
        rows={rows || []}
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
