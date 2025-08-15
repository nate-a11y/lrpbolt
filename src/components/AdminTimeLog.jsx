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
import dayjs from "../utils/dates";
import { fmtDateTime, humanDuration, tsToDayjs } from "../utils/dates";
import {
  subscribeTimeLogs,
  subscribeShootoutStats,
  fetchWeeklySummary,
} from "../hooks/api";

// Defensive wrappers prevent "Cannot destructure ... of null"
const safeVF = (fn) => (params) => { try { return fn(params || {}); } catch (e) { return "—"; } };
const safeVG = (fn) => (params) => { try { return fn(params || {}); } catch (e) { return undefined; } };
const safeSC = (fn) => (a, b) => { try { return fn(a, b); } catch (e) { return 0; } };

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
    { field: "driver", headerName: "Driver", flex: 1,
      valueGetter: safeVG((p) => p.row?.driver ?? "—") },
    { field: "rideId", headerName: "Ride ID", flex: 1,
      valueGetter: safeVG((p) => p.row?.rideId ?? "—") },
    { field: "startTime", headerName: "Start", flex: 1.2,
      sortComparator: safeSC((a, b) => (tsToDayjs(a)?.valueOf() || 0) - (tsToDayjs(b)?.valueOf() || 0)),
      valueFormatter: safeVF((p) => fmtDateTime(p.value)) },
    { field: "endTime", headerName: "End", flex: 1.2,
      sortComparator: safeSC((a, b) => (tsToDayjs(a)?.valueOf() || 0) - (tsToDayjs(b)?.valueOf() || 0)),
      valueFormatter: safeVF((p) => p.value ? fmtDateTime(p.value) : "—") },
    { field: "durationMin", headerName: "Duration", width: 140, type: "number",
      valueGetter: safeVG((p) => Number(p.row?.durationMin ?? 0)),
      valueFormatter: safeVF((p) => humanDuration(p.value)) },
    { field: "note", headerName: "Note", flex: 1,
      valueGetter: safeVG((p) => p.row?.note ?? "") },
    { field: "createdAt", headerName: "Logged", width: 170,
      valueFormatter: safeVF((p) => fmtDateTime(p.value)) },
  ];

  const entryFiltered = useMemo(() => {
    return entryRows.filter((r) => {
      if (entryDriver && !(r.driver || "").toLowerCase().includes(entryDriver.toLowerCase()))
        return false;
      const startDj = tsToDayjs(r.startTime);
      if (entryStartAfter && (!startDj || !startDj.isAfter(entryStartAfter))) return false;
      const endDj = tsToDayjs(r.endTime);
      if (
        entryEndBefore &&
        !(endDj ? endDj.isBefore(entryEndBefore) : startDj && startDj.isBefore(entryEndBefore))
      )
        return false;
      if (entrySearch) {
        const q = entrySearch.toLowerCase();
        const text = `${r.driver || ""} ${r.rideId || ""} ${r.note || ""}`.toLowerCase();
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
    { field: "driverEmail", headerName: "Driver", flex: 1,
      valueGetter: safeVG((p) => p.row?.driverEmail ?? "—") },
    { field: "vehicle", headerName: "Vehicle", flex: 1,
      valueGetter: safeVG((p) => p.row?.vehicle ?? "—") },
    { field: "trips", headerName: "Trips", width: 90, type: "number" },
    { field: "passengers", headerName: "Pax", width: 90, type: "number" },
    { field: "durationMin", headerName: "Duration", width: 140,
      valueFormatter: safeVF((p) => humanDuration(p.value)) },
    { field: "status", headerName: "Status", width: 110,
      valueGetter: safeVG((p) => p.row?.status ?? "Open") },
    { field: "startTime", headerName: "Start", flex: 1.2,
      valueFormatter: safeVF((p) => fmtDateTime(p.value)) },
    { field: "endTime", headerName: "End", flex: 1.2,
      valueFormatter: safeVF((p) => p.value ? fmtDateTime(p.value) : "—") },
    { field: "createdAt", headerName: "Created", width: 170,
      valueFormatter: safeVF((p) => fmtDateTime(p.value)) },
  ];

  const shootFiltered = useMemo(() => {
    return shootoutRows.filter((r) => {
      if (
        shootDriver &&
        !r.driverEmail?.toLowerCase().includes(shootDriver.toLowerCase())
      )
        return false;
      const startDj = tsToDayjs(r.startTime);
      if (shootStartAfter && (!startDj || !startDj.isAfter(shootStartAfter))) return false;
      const endDj = tsToDayjs(r.endTime);
      if (
        shootEndBefore &&
        !(endDj ? endDj.isBefore(shootEndBefore) : startDj && startDj.isBefore(shootEndBefore))
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
            rows={Array.isArray(entryFiltered) ? entryFiltered : []}
            columns={entryColumns}
            getRowId={(r) => r?.id ?? `${r?.driver ?? "row"}-${Math.random()}`}
            loading={!!loadingEntries}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 300 },
              },
            }}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
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
            rows={Array.isArray(shootFiltered) ? shootFiltered : []}
            columns={shootoutColumns}
            getRowId={(r) => r?.id ?? `${r?.driverEmail ?? "row"}-${Math.random()}`}
            loading={!!loadingShootout}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 300 },
              },
            }}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          />
        </Box>
      )}
    </PageContainer>
  );
}

