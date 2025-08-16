/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Tabs, Tab, TextField, Typography, Alert } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import PageContainer from "./PageContainer.jsx";
import { subscribeTimeLogs, subscribeShootoutStats } from "../hooks/api";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Chicago";

/** ---------- Time helpers ---------- */
function toMs(input) {
  if (input == null) return null;
  try {
    // Firestore Timestamp instance
    if (typeof input === "object" && typeof input.toDate === "function") {
      const t = input.toDate().getTime();
      return Number.isFinite(t) ? t : null;
    }
    // Firestore Timestamp-like POJO
    if (typeof input === "object") {
      if (Number.isFinite(input.seconds)) {
        const ns = Number.isFinite(input.nanoseconds) ? input.nanoseconds : 0;
        return input.seconds * 1000 + Math.floor(ns / 1e6);
      }
      if (Number.isFinite(input._seconds)) {
        const ns = Number.isFinite(input._nanoseconds) ? input._nanoseconds : 0;
        return input._seconds * 1000 + Math.floor(ns / 1e6);
      }
      if (Number.isFinite(input.millis)) return input.millis;
    }
    // JS Date
    if (input instanceof Date) {
      const t = input.getTime();
      return Number.isFinite(t) ? t : null;
    }
    // number or numeric string
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input === "string") {
      const n = Number(input);
      if (Number.isFinite(n)) return n;
      const t = Date.parse(input);
      return Number.isFinite(t) ? t : null;
    }
  } catch (_) {}
  return null;
}

function fmtDateTimeMs(ms) {
  if (!Number.isFinite(ms)) return "";
  return dayjs.tz(ms, TZ).format("MMM D, h:mm A");
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h >= 1 ? `${h}h ${m}m` : `${m}m`;
}

/** ---------- Normalizers ---------- */
function normalizeTimeLog(r) {
  const startMs = toMs(r.startTime);
  const endMs = toMs(r.endTime);
  const durationMs =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
      ? endMs - startMs
      : Number.isFinite(r.duration)
      ? Math.floor(Number(r.duration) * 60 * 1000) // if someone stored minutes as number
      : null;

  return {
    // Stable id: prefer explicit id from hook, else derive
    id:
      r.id ??
      `${(r.driverEmail || r.driver || "row").toLowerCase()}-${startMs ?? toMs(r.loggedAt) ?? 0}-${endMs ?? 0}`,
    driverEmail: r.driverEmail || r.driver || "",
    vehicle: r.vehicle || r.rideId || "",
    startTime: startMs,
    endTime: endMs,
    duration: durationMs,
    trips: Number.isFinite(r.trips) ? r.trips : 0,
    passengers: Number.isFinite(r.passengers) ? r.passengers : 0,
    note: r.note || "",
    raw: r,
  };
}

function normalizeShootout(r) {
  return {
    id:
      r.id ??
      `${(r.driverEmail || "row").toLowerCase()}-${toMs(r.startTime) ?? toMs(r.createdAt) ?? 0}-${toMs(r.endTime) ?? 0}`,
    driverEmail: r.driverEmail || "",
    vehicle: r.vehicle || "",
    startTime: toMs(r.startTime),
    endTime: toMs(r.endTime),
    trips: Number.isFinite(r.trips) ? r.trips : 0,
    passengers: Number.isFinite(r.passengers) ? r.passengers : 0,
    createdAt: toMs(r.createdAt),
    status: r.status || "",
    raw: r,
  };
}

/** ---------- Columns (shared patterns) ---------- */
const startCol = (field = "startTime") => ({
  field,
  headerName: "Start",
  flex: 1,
  minWidth: 160,
  valueGetter: (p) => p?.row?.[field],
  valueFormatter: (p) => fmtDateTimeMs(p?.value),
  renderCell: (p) => fmtDateTimeMs(p?.row?.[field]),
  sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
});

const endCol = (field = "endTime") => ({
  field,
  headerName: "End",
  flex: 1,
  minWidth: 160,
  valueGetter: (p) => p?.row?.[field],
  valueFormatter: (p) => fmtDateTimeMs(p?.value),
  renderCell: (p) => fmtDateTimeMs(p?.row?.[field]),
  sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
});

const durationCol = (field = "duration") => ({
  field,
  headerName: "Duration",
  flex: 0.6,
  minWidth: 120,
  valueGetter: (p) => p?.row?.[field] ?? null,
  valueFormatter: (p) => fmtDuration(p?.value),
  renderCell: (p) => fmtDuration(p?.row?.[field]),
  sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
});

export default function AdminTimeLog() {
  const [tab, setTab] = useState(0);

  /** ---------------- Entries (timeLogs) ---------------- */
  const [rawTimeLogs, setRawTimeLogs] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entryError, setEntryError] = useState("");

  const [entrySearch, setEntrySearch] = useState("");
  const [entryDriver, setEntryDriver] = useState("");
  const [entryStartAfter, setEntryStartAfter] = useState(null); // dayjs | null
  const [entryEndBefore, setEntryEndBefore] = useState(null); // dayjs | null

  useEffect(() => {
    const unsub = subscribeTimeLogs(
      (rows) => {
        setRawTimeLogs(Array.isArray(rows) ? rows : []);
        setLoadingEntries(false);
      },
      (e) => {
        console.error(e);
        setEntryError("Failed to load time logs.");
        setLoadingEntries(false);
      }
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const entryRows = useMemo(
    () => (Array.isArray(rawTimeLogs) ? rawTimeLogs.map(normalizeTimeLog) : []),
    [rawTimeLogs]
  );

  const entryColumns = useMemo(
    () => [
      { field: "driverEmail", headerName: "Driver", flex: 1, minWidth: 180 },
      { field: "vehicle", headerName: "Vehicle / Ride", flex: 1, minWidth: 160 },
      startCol("startTime"),
      endCol("endTime"),
      durationCol("duration"),
      {
        field: "trips",
        headerName: "Trips",
        type: "number",
        width: 90,
      },
      {
        field: "passengers",
        headerName: "Pax",
        type: "number",
        width: 90,
      },
    ],
    []
  );

  const entryFiltered = useMemo(() => {
    return entryRows.filter((r) => {
      // driver filter
      if (entryDriver && !r.driverEmail.toLowerCase().includes(entryDriver.toLowerCase())) {
        return false;
      }
      // date range filters operate on start/end (if no end, use start)
      const startDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      const endDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;

      if (entryStartAfter && (!startDj || !startDj.isAfter(entryStartAfter))) return false;
      if (entryEndBefore) {
        const compareDj = endDj || startDj;
        if (!compareDj || !compareDj.isBefore(entryEndBefore)) return false;
      }

      // search across driver/vehicle/note
      if (entrySearch) {
        const q = entrySearch.toLowerCase();
        const text = `${r.driverEmail} ${r.vehicle} ${r.note}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [entryRows, entryDriver, entryStartAfter, entryEndBefore, entrySearch]);

  /** ---------------- Shootout (shootoutStats) ---------------- */
  const [rawShootout, setRawShootout] = useState([]);
  const [loadingShootout, setLoadingShootout] = useState(true);
  const [shootError, setShootError] = useState("");

  const [shootSearch, setShootSearch] = useState("");
  const [shootDriver, setShootDriver] = useState("");
  const [shootStartAfter, setShootStartAfter] = useState(null);
  const [shootEndBefore, setShootEndBefore] = useState(null);

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      (rows) => {
        setRawShootout(Array.isArray(rows) ? rows : []);
        setLoadingShootout(false);
      },
      (e) => {
        console.error(e);
        setShootError("Failed to load shootout stats.");
        setLoadingShootout(false);
      }
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const shootoutRows = useMemo(
    () => (Array.isArray(rawShootout) ? rawShootout.map(normalizeShootout) : []),
    [rawShootout]
  );

  const shootoutColumns = useMemo(
    () => [
      { field: "driverEmail", headerName: "Driver", flex: 1, minWidth: 180 },
      { field: "vehicle", headerName: "Vehicle", flex: 1, minWidth: 140 },
      startCol("startTime"),
      endCol("endTime"),
      durationCol("duration"), // computed on the fly via renderCell below
      {
        field: "trips",
        headerName: "Trips",
        type: "number",
        width: 90,
      },
      {
        field: "passengers",
        headerName: "Pax",
        type: "number",
        width: 90,
      },
      { field: "status", headerName: "Status", width: 110 },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 170,
        valueGetter: (p) => p?.row?.createdAt,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
        sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
    ],
    []
  );

  // add computed duration to shootout rows (not always stored)
  const shootFiltered = useMemo(() => {
    return shootoutRows
      .map((r) => ({
        ...r,
        duration:
          Number.isFinite(r.startTime) && Number.isFinite(r.endTime) && r.endTime >= r.startTime
            ? r.endTime - r.startTime
            : null,
      }))
      .filter((r) => {
        if (shootDriver && !r.driverEmail.toLowerCase().includes(shootDriver.toLowerCase()))
          return false;

        const startDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
        const endDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;

        if (shootStartAfter && (!startDj || !startDj.isAfter(shootStartAfter))) return false;

        if (shootEndBefore) {
          const compareDj = endDj || startDj;
          if (!compareDj || !compareDj.isBefore(shootEndBefore)) return false;
        }

        if (shootSearch) {
          const q = shootSearch.toLowerCase();
          const text = `${r.driverEmail} ${r.vehicle} ${r.status}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      });
  }, [shootoutRows, shootDriver, shootStartAfter, shootEndBefore, shootSearch]);

  /** ---------------- Weekly Summary (from timeLogs) ---------------- */
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const weekEnd = useMemo(() => weekStart.add(1, "week"), [weekStart]);

  const weekly = useMemo(() => {
    // filter timeLogs into selected week
    const inWeek = entryRows.filter((r) => {
      const s = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      if (!s) return false;
      return (s.isAfter(weekStart) || s.isSame(weekStart)) && s.isBefore(weekEnd);
    });

    // roll-up by driver
    const byDriver = new Map();
    for (const r of inWeek) {
      const key = r.driverEmail || "Unknown";
      const prev = byDriver.get(key) || {
        driver: key,
        sessions: 0,
        ms: 0,
        trips: 0,
        passengers: 0,
      };
      prev.sessions += 1;
      prev.ms += Number.isFinite(r.duration) ? r.duration : 0;
      prev.trips += Number.isFinite(r.trips) ? r.trips : 0;
      prev.passengers += Number.isFinite(r.passengers) ? r.passengers : 0;
      byDriver.set(key, prev);
    }

    return Array.from(byDriver.values()).map((v, i) => ({
      id: i,
      driver: v.driver,
      sessions: v.sessions,
      hours: Number((v.ms / 3600000).toFixed(2)),
      trips: v.trips,
      passengers: v.passengers,
    }));
  }, [entryRows, weekStart, weekEnd]);

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

      {/* --------- Entries Tab --------- */}
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
            rows={entryFiltered}
            columns={entryColumns}
            loading={!!loadingEntries}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
            }}
            initialState={{
              sorting: { sortModel: [{ field: "startTime", sort: "desc" }] },
              pagination: { paginationModel: { pageSize: 10 } },
            }}
          />
        </Box>
      )}

      {/* --------- Weekly Tab --------- */}
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
          {weekly.length === 0 ? (
            <Typography variant="body2">No data for selected week.</Typography>
          ) : (
            <DataGrid
              autoHeight
              density="compact"
              rows={weekly}
              columns={[
                { field: "driver", headerName: "Driver", flex: 1 },
                { field: "sessions", headerName: "Sessions", width: 120, type: "number" },
                { field: "hours", headerName: "Hours", width: 110, type: "number" },
                { field: "trips", headerName: "Trips", width: 110, type: "number" },
                { field: "passengers", headerName: "Pax", width: 110, type: "number" },
              ]}
              hideFooterSelectedRowCount
              initialState={{
                sorting: { sortModel: [{ field: "hours", sort: "desc" }] },
                pagination: { paginationModel: { pageSize: 10 } },
              }}
            />
          )}
        </Box>
      )}

      {/* --------- Shootout Tab --------- */}
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
            rows={shootFiltered}
            columns={shootoutColumns}
            loading={!!loadingShootout}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
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
