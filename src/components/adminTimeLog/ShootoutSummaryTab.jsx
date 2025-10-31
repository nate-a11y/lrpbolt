/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo } from "react";
import { Paper, CircularProgress } from "@mui/material";

import { formatTz } from "@/utils/timeSafe";
import UniversalDataGrid from "@/components/datagrid/UniversalDataGrid";
import { EmptyState, ErrorState } from "@/components/feedback/SectionState.jsx";

import { subscribeShootoutStats } from "../../hooks/firestore";
import { enrichDriverNames } from "../../services/normalizers";
import logError from "../../utils/logError.js";

export default function ShootoutSummaryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
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
        field: "vehicle",
        headerName: "Vehicle",
        minWidth: 140,
        flex: 1,
        valueGetter: (value, row) => row?.vehicle || "N/A",
      },
      {
        field: "sessions",
        headerName: "Sessions",
        minWidth: 120,
        valueGetter: (value, row) => row?.sessions ?? null,
      },
      {
        field: "trips",
        headerName: "Trips",
        minWidth: 120,
        valueGetter: (value, row) => row?.trips ?? null,
      },
      {
        field: "passengers",
        headerName: "PAX",
        minWidth: 120,
        valueGetter: (value, row) => row?.passengers ?? null,
      },
      {
        field: "totalMinutes",
        headerName: "Minutes",
        minWidth: 140,
        valueGetter: (value, row) => row?.totalMinutes ?? null,
      },
      {
        field: "hours",
        headerName: "Hours",
        minWidth: 140,
        valueGetter: (value, row) => {
          const val = row?.hours;
          return Number.isFinite(val) ? Number(val.toFixed?.(2) ?? val) : "N/A";
        },
      },
      {
        field: "firstStart",
        headerName: "First Start",
        minWidth: 180,
        flex: 1,
        valueGetter: (value, row) => formatTz(row?.firstStart) || "N/A",
      },
      {
        field: "lastEnd",
        headerName: "Last End",
        minWidth: 180,
        flex: 1,
        valueGetter: (value, row) => formatTz(row?.lastEnd) || "N/A",
      },
      {
        field: "id",
        headerName: "id",
        minWidth: 120,
        valueGetter: (value, row) => row?.id || "N/A",
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
    setLoading(true);
    setError(null);
    const unsub = subscribeShootoutStats(
      async (stats) => {
        try {
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
              (start && start.seconds < prev.firstStart?.seconds)
                ? start
                : prev.firstStart;
            const lastEnd =
              !prev.lastEnd || (end && end.seconds > prev.lastEnd?.seconds)
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
          setError(null);
        } catch (err) {
          logError(err, { where: "ShootoutSummaryTab", action: "process" });
          setError("Failed to build shootout summary.");
        } finally {
          setLoading(false);
        }
      },
      (e) => {
        logError(e, { where: "ShootoutSummaryTab", action: "subscribe" });
        setError(e?.message || "Failed to load shootout summary.");
        setLoading(false);
      },
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [refreshKey]);

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
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {rows?.length ? (
        <UniversalDataGrid
          id="admin-timelog-shootout-summary-grid"
          rows={rows}
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
          title="No shootout summary"
          description="Once sessions are recorded, you’ll see combined stats here."
          actionLabel="Refresh"
          onAction={() => setRefreshKey((key) => key + 1)}
        />
      )}
    </Paper>
  );
}
