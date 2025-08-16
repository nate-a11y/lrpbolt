/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Tabs,
  Tab,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";

import PageContainer from "./PageContainer.jsx";
import {
  subscribeTimeLogs,
  subscribeShootoutStats,
  fetchWeeklySummary,
} from "../hooks/api";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Chicago";

function toMs(input) {
  if (!input) return null;
  try {
    if (typeof input === "object" && input.seconds != null && input.nanoseconds != null) {
      return input.seconds * 1000 + Math.floor(input.nanoseconds / 1e6);
    }
    if (input.toDate && typeof input.toDate === "function") {
      const d = input.toDate();
      const ms = d?.getTime?.();
      return Number.isFinite(ms) ? ms : null;
    }
    if (input instanceof Date) {
      const ms = input.getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof input === "number" && Number.isFinite(input)) {
      return input;
    }
    if (typeof input === "string") {
      const ms = Date.parse(input);
      return Number.isFinite(ms) ? ms : null;
    }
  } catch {
    // ignore malformed inputs
  }
  return null;
}

function fmtDateTimeMs(ms) {
  if (!Number.isFinite(ms)) return "";
  return dayjs.tz(ms, TZ).format("MMM D, h:mm A");
}

function durationMs(startMs, endMs) {
  if (!Number.isFinite(startMs)) return null;
  if (!Number.isFinite(endMs)) return null;
  const diff = endMs - startMs;
  return diff >= 0 ? diff : null;
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AdminTimeLog() {
  const [tab, setTab] = useState(0);

  // ---- Entries ----
  const [entryRows, setEntryRows] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entryError, setEntryError] = useState("");
  const [entryDriver, setEntryDriver] = useState("");
  const [entryStartAfter, setEntryStartAfter] = useState(null);
  const [entryEndBefore, setEntryEndBefore] = useState(null);
  const [entrySearch, setEntrySearch] = useState("");

  useEffect(() => {
    const unsub = subscribeTimeLogs(
      (rows) => {
        setEntryRows(Array.isArray(rows) ? rows : []);
        setLoadingEntries(false);
      },
      (e) => {
        console.error(e);
        setEntryError("Failed to load time logs.");
        setLoadingEntries(false);
      },
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const entryColumns = [
    {
      field: "driverEmail",
      headerName: "Driver",
      flex: 1,
      minWidth: 180,
      valueGetter: (p) => p?.row?.driverEmail ?? "",
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      flex: 1,
      minWidth: 140,
      valueGetter: (p) => p?.row?.vehicle ?? "",
    },
    {
      field: "startTime",
      headerName: "Start",
      flex: 1,
      minWidth: 160,
      valueGetter: (p) => toMs(p?.row?.startTime),
      valueFormatter: (p) => fmtDateTimeMs(p?.value),
      sortComparator: (v1, v2) => {
        const a = Number.isFinite(v1) ? v1 : -1;
        const b = Number.isFinite(v2) ? v2 : -1;
        return a - b;
      },
    },
    {
      field: "endTime",
      headerName: "End",
      flex: 1,
      minWidth: 160,
      valueGetter: (p) => toMs(p?.row?.endTime),
      valueFormatter: (p) => fmtDateTimeMs(p?.value),
      sortComparator: (v1, v2) => {
        const a = Number.isFinite(v1) ? v1 : -1;
        const b = Number.isFinite(v2) ? v2 : -1;
        return a - b;
      },
    },
    {
      field: "duration",
      headerName: "Duration",
      flex: 0.6,
      minWidth: 120,
      valueGetter: (p) => {
        const s = toMs(p?.row?.startTime);
        const e = toMs(p?.row?.endTime);
        const d = durationMs(s, e);
        return Number.isFinite(d) ? d : null;
      },
      valueFormatter: (p) => fmtDuration(p?.value),
      sortComparator: (v1, v2) => {
        const a = Number.isFinite(v1) ? v1 : -1;
        const b = Number.isFinite(v2) ? v2 : -1;
        return a - b;
      },
    },
    {
      field: "trips",
      headerName: "Trips",
      type: "number",
      width: 90,
      valueGetter: (p) => (Number.isFinite(p?.row?.trips) ? p.row.trips : 0),
    },
    {
      field: "passengers",
      headerName: "Pax",
      type: "number",
      width: 90,
      valueGetter: (p) =>
        Number.isFinite(p?.row?.passengers) ? p.row.passengers : 0,
    },
  ];

  const entryFiltered = useMemo(() => {
    return entryRows.filter((r) => {
      if (
        entryDriver &&
        !(r.driverEmail || "")
          .toLowerCase()
          .includes(entryDriver.toLowerCase())
      )
        return false;
      const startMs = toMs(r.startTime);
      const startDj = Number.isFinite(startMs) ? dayjs(startMs) : null;
      if (entryStartAfter && (!startDj || !startDj.isAfter(entryStartAfter))) return false;
      const endMs = toMs(r.endTime);
      const endDj = Number.isFinite(endMs) ? dayjs(endMs) : null;
      if (
        entryEndBefore &&
        !(endDj
          ? endDj.isBefore(entryEndBefore)
          : startDj && startDj.isBefore(entryEndBefore))
      )
        return false;
      if (entrySearch) {
        const q = entrySearch.toLowerCase();
        const text = `${r.driverEmail || ""} ${r.vehicle || ""} ${r.note || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [entryRows, entryDriver, entryStartAfter, entryEndBefore, entrySearch]);

  // ---- Shootout Stats ----
  const [shootoutRows, setShootoutRows] = useState([]);
  const [loadingShootout, setLoadingShootout] = useState(true);
  const [shootError, setShootError] = useState("");
  const [shootDriver, setShootDriver] = useState("");
  const [shootStartAfter, setShootStartAfter] = useState(null);
  const [shootEndBefore, setShootEndBefore] = useState(null);
  const [shootSearch, setShootSearch] = useState("");

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      (rows) => {
        setShootoutRows(Array.isArray(rows) ? rows : []);
        setLoadingShootout(false);
      },
      (e) => {
        console.error(e);
        setShootError("Failed to load shootout stats.");
        setLoadingShootout(false);
      },
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const shootoutColumns = [
    {
      field: "driverEmail",
      headerName: "Driver",
      flex: 1,
      valueGetter: (p) => p?.row?.driverEmail ?? "",
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      flex: 1,
      valueGetter: (p) => p?.row?.vehicle ?? "",
    },
    {
      field: "startTime",
      headerName: "Start",
      flex: 1,
      minWidth: 160,
      valueGetter: (p) => toMs(p?.row?.startTime),
      valueFormatter: (p) => fmtDateTimeMs(p?.value),
      sortComparator: (v1, v2) => {
        const a = Number.isFinite(v1) ? v1 : -1;
        const b = Number.isFinite(v2) ? v2 : -1;
        return a - b;
      },
    },
    {
      field: "endTime",
      headerName: "End",
      flex: 1,
      minWidth: 160,
      valueGetter: (p) => toMs(p?.row?.endTime),
      valueFormatter: (p) => fmtDateTimeMs(p?.value),
      sortComparator: (v1, v2) => {
        const a = Number.isFinite(v1) ? v1 : -1;
        const b = Number.isFinite(v2) ? v2 : -1;
        return a - b;
      },
    },
    {
      field: "duration",
      headerName: "Duration",
      flex: 0.6,
      minWidth: 120,
      valueGetter: (p) => {
        const s = toMs(p?.row?.startTime);
        const e = toMs(p?.row?.endTime);
        const d = durationMs(s, e);
        return Number.isFinite(d) ? d : null;
      },
      valueFormatter: (p) => fmtDuration(p?.value),
      sortComparator: (v1, v2) => {
        const a = Number.isFinite(v1) ? v1 : -1;
        const b = Number.isFinite(v2) ? v2 : -1;
        return a - b;
      },
    },
    {
      field: "trips",
      headerName: "Trips",
      type: "number",
      width: 90,
      valueGetter: (p) => (Number.isFinite(p?.row?.trips) ? p.row.trips : 0),
    },
    {
      field: "passengers",
      headerName: "Pax",
      type: "number",
      width: 90,
      valueGetter: (p) =>
        Number.isFinite(p?.row?.passengers) ? p.row.passengers : 0,
    },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      valueGetter: (p) => p?.row?.status ?? "",
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 170,
      valueGetter: (p) => toMs(p?.row?.createdAt),
      valueFormatter: (p) => fmtDateTimeMs(p?.value),
      sortComparator: (v1, v2) => {
        const a = Number.isFinite(v1) ? v1 : -1;
        const b = Number.isFinite(v2) ? v2 : -1;
        return a - b;
      },
    },
  ];

  const shootFiltered = useMemo(() => {
    return shootoutRows.filter((r) => {
      if (
        shootDriver &&
        !r.driverEmail?.toLowerCase().includes(shootDriver.toLowerCase())
      )
        return false;
      const startMs = toMs(r.startTime);
      const startDj = Number.isFinite(startMs) ? dayjs(startMs) : null;
      if (shootStartAfter && (!startDj || !startDj.isAfter(shootStartAfter))) return false;
      const endMs = toMs(r.endTime);
      const endDj = Number.isFinite(endMs) ? dayjs(endMs) : null;
      if (
        shootEndBefore &&
        !(endDj
          ? endDj.isBefore(shootEndBefore)
          : startDj && startDj.isBefore(shootEndBefore))
      )
        return false;
      if (shootSearch) {
        const q = shootSearch.toLowerCase();
        const text = `${r.driverEmail || ""} ${r.vehicle || ""} ${r.status || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [shootoutRows, shootDriver, shootStartAfter, shootEndBefore, shootSearch]);

  // ---- Weekly Summary ----
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const [weekly, setWeekly] = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState("");

  const loadWeekly = async (startTs, endTs) => {
    setWeeklyLoading(true);
    setWeeklyError("");
    try {
      const rows = await fetchWeeklySummary({ startTs, endTs });
      setWeekly(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setWeeklyError("Failed to load weekly summary.");
    } finally {
      setWeeklyLoading(false);
    }
  };

  useEffect(() => {
    const start = weekStart.toDate();
    const end = weekStart.add(1, "week").toDate();
    loadWeekly(start, end);
  }, [weekStart]);

  return (
    <PageContainer pt={2} pb={4}>
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="Entries" />
          <Tab label="Weekly Summary" />
          <Tab label="Shootout Stats" />
        </Tabs>
      </Box>
      {tab === 0 && (
        <Box>
          {entryError && <Alert severity="error">{entryError}</Alert>}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <TextField
              label="Search"
              value={entrySearch}
              onChange={(e) => setEntrySearch(e.target.value)}
              size="small"
            />
            <TextField
              label="Driver"
              value={entryDriver}
              onChange={(e) => setEntryDriver(e.target.value)}
              size="small"
            />
            <DatePicker
              label="Start after"
              value={entryStartAfter}
              onChange={(v) => setEntryStartAfter(v)}
              slotProps={{ textField: { size: "small" } }}
            />
            <DatePicker
              label="End before"
              value={entryEndBefore}
              onChange={(v) => setEntryEndBefore(v)}
              slotProps={{ textField: { size: "small" } }}
            />
          </Box>
          <DataGrid
            autoHeight
            density="compact"
            rows={entryFiltered || []}
            columns={entryColumns}
            getRowId={(r) =>
              r?.id ?? `${r?.driverEmail ?? "row"}-${Math.random()}`
            }
            loading={!!loadingEntries}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 300 },
              },
            }}
            initialState={{
              sorting: { sortModel: [{ field: "startTime", sort: "desc" }] },
              pagination: { paginationModel: { pageSize: 10 } },
            }}
          />
        </Box>
      )}
      {tab === 1 && (
        <Box>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <DatePicker
              label="Week of"
              value={weekStart}
              onChange={(v) => v && setWeekStart(v.startOf("week"))}
              slotProps={{ textField: { size: "small" } }}
            />
          </Box>
          {weeklyLoading ? (
            <Typography variant="body2">Loading weekly summary…</Typography>
          ) : weeklyError ? (
            <Alert severity="error">{weeklyError}</Alert>
          ) : weekly.length === 0 ? (
            <Typography variant="body2">No data for selected week.</Typography>
          ) : (
            <DataGrid
              rows={weekly.map((r, i) => ({ id: i, ...r }))}
              columns={[
                { field: "driver", headerName: "Driver", flex: 1 },
                { field: "sessions", headerName: "Sessions", width: 110, type: "number" },
                { field: "hours", headerName: "Hours", width: 110, type: "number" },
                { field: "trips", headerName: "Trips", width: 110, type: "number" },
                { field: "passengers", headerName: "Pax", width: 110, type: "number" },
              ]}
              hideFooterSelectedRowCount
            />
          )}
        </Box>
      )}
      {tab === 2 && (
        <Box>
          {shootError && <Alert severity="error">{shootError}</Alert>}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <TextField
              label="Search"
              value={shootSearch}
              onChange={(e) => setShootSearch(e.target.value)}
              size="small"
            />
            <TextField
              label="Driver"
              value={shootDriver}
              onChange={(e) => setShootDriver(e.target.value)}
              size="small"
            />
            <DatePicker
              label="Start after"
              value={shootStartAfter}
              onChange={(v) => setShootStartAfter(v)}
              slotProps={{ textField: { size: "small" } }}
            />
            <DatePicker
              label="End before"
              value={shootEndBefore}
              onChange={(v) => setShootEndBefore(v)}
              slotProps={{ textField: { size: "small" } }}
            />
          </Box>
          <DataGrid
            autoHeight
            density="compact"
            rows={shootFiltered || []}
            columns={shootoutColumns}
            getRowId={(r) =>
              r?.id ?? `${r?.driverEmail ?? "row"}-${Math.random()}`
            }
            loading={!!loadingShootout}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 300 },
              },
            }}
            initialState={{
              sorting: { sortModel: [{ field: "startTime", sort: "desc" }] },
              pagination: { paginationModel: { pageSize: 10 } },
            }}
          />
        </Box>
      )}
    </PageContainer>
  );
}

