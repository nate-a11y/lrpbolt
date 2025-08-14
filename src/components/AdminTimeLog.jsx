/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Paper, CircularProgress, Alert, Tabs, Tab } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { isNil, tsToDate, fmtDateTime } from "../utils/timeUtilsSafe";
import { normalizeTimeLog, normalizeShootout } from "../utils/normalizeTimeLog";
import PageContainer from "./PageContainer.jsx";

// ---------------- Data hooks ----------------
const useTimeLogs = () => {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  useEffect(() => {
    try {
      const qRef = query(collection(db, "timeLogs"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(qRef, (snap) => {
        const data = []; snap.forEach((doc) => data.push(normalizeTimeLog(doc.id, doc.data() || {})));
        setRows(data); setLoading(false);
      }, (err) => { setError(err?.message || "Failed to load time logs."); setLoading(false); });
      return () => unsub();
    } catch (e) { setError(e?.message || "Failed to subscribe to time logs."); setLoading(false); }
  }, []);
  return { rows, loading, error };
};

const useShootoutStats = () => {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  useEffect(() => {
    try {
      const qRef = query(collection(db, "shootoutStats"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(qRef, (snap) => {
        const data = []; snap.forEach((doc) => data.push(normalizeShootout(doc.id, doc.data() || {})));
        setRows(data); setLoading(false);
      }, (err) => { setError(err?.message || "Failed to load shootout stats."); setLoading(false); });
      return () => unsub();
    } catch (e) { setError(e?.message || "Failed to subscribe to shootout stats."); setLoading(false); }
  }, []);
  return { rows, loading, error };
};

// ---------------- Columns (Entries) ----------------
export const entriesColumns = [
  {
    field: "driverDisplay", headerName: "Driver", flex: 1, minWidth: 160,
    valueGetter: (p = {}) => p?.row?.driverDisplay ?? null,
    valueFormatter: (p = {}) => { const v = p?.value; return isNil(v) || v === "" ? "—" : String(v); },
  },
  {
    field: "rideId", headerName: "Ride ID", flex: 0.8, minWidth: 110,
    valueGetter: (p = {}) => p?.row?.rideId ?? null,
    valueFormatter: (p = {}) => { const v = p?.value; return isNil(v) || v === "" ? "—" : String(v); },
  },
  {
    field: "mode", headerName: "Mode", flex: 0.7, minWidth: 100,
    valueGetter: (p = {}) => p?.row?.mode ?? null,
    valueFormatter: (p = {}) => (isNil(p?.value) ? "—" : String(p.value)),
  },
  {
    field: "startTime", headerName: "Start", type: "dateTime", flex: 1, minWidth: 190,
    valueGetter: (p = {}) => p?.row?.startTime ?? null,
    valueFormatter: (p = {}) => fmtDateTime(p?.value),
    sortComparator: (a, b) => (tsToDate(a)?.getTime() ?? -1) - (tsToDate(b)?.getTime() ?? -1),
  },
  {
    field: "endTime", headerName: "End", type: "dateTime", flex: 1, minWidth: 190,
    valueGetter: (p = {}) => p?.row?.endTime ?? null,
    valueFormatter: (p = {}) => fmtDateTime(p?.value),
    sortComparator: (a, b) => (tsToDate(a)?.getTime() ?? -1) - (tsToDate(b)?.getTime() ?? -1),
  },
  {
    field: "durationMin", headerName: "Duration", description: "Stored or computed (minutes)", flex: 0.7, minWidth: 120,
    valueGetter: (p = {}) => { const v = p?.row?.durationMin; return isNil(v) ? null : Number(v); },
    valueFormatter: (p = {}) => (isNil(p?.value) ? "—" : `${p.value} min`),
    sortComparator: (a, b) => (isNil(a) ? -1 : Number(a)) - (isNil(b) ? -1 : Number(b)),
  },
];

// ---------------- Weekly Summary (group by driver) ----------------
export const buildWeeklySummary = (normalizedRows = []) => {
  const byDriver = new Map();
  for (const r of normalizedRows) {
    const key = (r?.driverDisplay || "unknown").toString().toLowerCase().trim();
    if (!byDriver.has(key)) byDriver.set(key, { id: key, driver: key, trips: 0, minutes: 0 });
    const acc = byDriver.get(key);
    acc.trips += Number.isFinite(r?.trips) ? r.trips : 0;
    // minutes: prefer r.durationMin, else compute from times if present
    let m = null;
    if (!isNil(r?.durationMin)) m = Number(r.durationMin);
    else if (r?.startTime || r?.endTime) {
      const start = tsToDate(r.startTime); const end = tsToDate(r.endTime);
      if (start && end) m = Math.max(0, Math.round((end - start) / 60000));
    }
    acc.minutes += Number.isFinite(m) ? m : 0;
  }
  return [...byDriver.values()].map((x) => ({ ...x, hours: (x.minutes / 60).toFixed(2) }));
};

// ---------------- Shootout columns ----------------
export const shootoutColumns = [
  { field: "driverDisplay", headerName: "Driver", flex: 1, minWidth: 160,
    valueGetter: (p = {}) => p?.row?.driverDisplay ?? null,
    valueFormatter: (p = {}) => (isNil(p?.value) || p.value === "" ? "—" : String(p.value)) },
  { field: "trips", headerName: "Trips", type: "number", flex: 0.5, minWidth: 90,
    valueGetter: (p = {}) => (isNil(p?.row?.trips) ? null : Number(p.row.trips)),
    valueFormatter: (p = {}) => (isNil(p?.value) ? "—" : String(p.value)) },
  { field: "passengers", headerName: "Pax", type: "number", flex: 0.5, minWidth: 90,
    valueGetter: (p = {}) => (isNil(p?.row?.passengers) ? null : Number(p.row.passengers)),
    valueFormatter: (p = {}) => (isNil(p?.value) ? "—" : String(p.value)) },
  { field: "durationMin", headerName: "Duration", flex: 0.7, minWidth: 120,
    valueGetter: (p = {}) => (isNil(p?.row?.durationMin) ? null : Number(p.row.durationMin)),
    valueFormatter: (p = {}) => (isNil(p?.value) ? "—" : `${p.value} min`) },
  { field: "status", headerName: "Status", flex: 0.7, minWidth: 110,
    valueGetter: (p = {}) => p?.row?.status ?? null,
    valueFormatter: (p = {}) => (isNil(p?.value) ? "—" : String(p.value)) },
  { field: "startTime", headerName: "Start", type: "dateTime", flex: 1, minWidth: 190,
    valueGetter: (p = {}) => p?.row?.startTime ?? null, valueFormatter: (p = {}) => fmtDateTime(p?.value) },
  { field: "endTime", headerName: "End", type: "dateTime", flex: 1, minWidth: 190,
    valueGetter: (p = {}) => p?.row?.endTime ?? null, valueFormatter: (p = {}) => fmtDateTime(p?.value) },
  { field: "createdAt", headerName: "Created", type: "dateTime", flex: 1, minWidth: 190,
    valueGetter: (p = {}) => p?.row?.createdAt ?? null, valueFormatter: (p = {}) => fmtDateTime(p?.value) },
];

export default function AdminTimeLog() {
  const [tab, setTab] = useState(0);
  const { rows: entryRows, loading: eload, error: eerr } = useTimeLogs();
  const { rows: shootRows, loading: sload, error: serr } = useShootoutStats();
  const summaryRows = useMemo(() => buildWeeklySummary(entryRows), [entryRows]);

  const summaryColumns = useMemo(() => [
    { field: "driver", headerName: "Driver", flex: 1, minWidth: 160,
      valueGetter: (p = {}) => p?.row?.driver ?? null,
      valueFormatter: (p = {}) => (isNil(p?.value) || p.value === "" ? "—" : String(p.value)) },
    { field: "trips", headerName: "Trips", type: "number", flex: 0.5, minWidth: 90,
      valueGetter: (p = {}) => (isNil(p?.row?.trips) ? null : Number(p.row.trips)),
      valueFormatter: (p = {}) => (isNil(p?.value) ? "—" : String(p.value)) },
    { field: "hours", headerName: "Hours", type: "number", flex: 0.5, minWidth: 90,
      valueGetter: (p = {}) => (isNil(p?.row?.hours) ? null : Number(p.row.hours)),
      valueFormatter: (p = {}) => (isNil(p?.value) ? "—" : Number(p.value).toFixed(2)) },
  ], []);

  const renderEntries = () => {
    if (eload) return <Box p={2}><CircularProgress size={24} /></Box>;
    if (eerr) return <Box p={2}><Alert severity="error">{eerr}</Alert></Box>;
    return (
      <Paper sx={{ p: 1 }}>
        <div style={{ height: 640, width: "100%" }}>
          <DataGrid rows={entryRows} columns={entriesColumns} disableRowSelectionOnClick />
        </div>
      </Paper>
    );
  };

  const renderSummary = () => {
    if (eload) return <Box p={2}><CircularProgress size={24} /></Box>;
    if (eerr) return <Box p={2}><Alert severity="error">{eerr}</Alert></Box>;
    return (
      <Paper sx={{ p: 1 }}>
        <div style={{ height: 640, width: "100%" }}>
          <DataGrid rows={summaryRows} columns={summaryColumns} disableRowSelectionOnClick />
        </div>
      </Paper>
    );
  };

  const renderShootout = () => {
    if (sload) return <Box p={2}><CircularProgress size={24} /></Box>;
    if (serr) return <Box p={2}><Alert severity="error">{serr}</Alert></Box>;
    return (
      <Paper sx={{ p: 1 }}>
        <div style={{ height: 640, width: "100%" }}>
          <DataGrid rows={shootRows} columns={shootoutColumns} disableRowSelectionOnClick />
        </div>
      </Paper>
    );
  };

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
      {tab === 0 && renderEntries()}
      {tab === 1 && renderSummary()}
      {tab === 2 && renderShootout()}
    </PageContainer>
  );
}
