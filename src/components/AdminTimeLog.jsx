/* Proprietary and confidential. See LICENSE. */
// src/components/AdminTimeLog.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Tabs, Tab, Stack, Typography, Divider } from "@mui/material";

import { timeLogColumns } from "../columns/timeLogColumns.js";
import { shootoutColumns } from "../columns/shootoutColumns.js";
import { subscribeTimeLogs, subscribeShootoutStats } from "../hooks/api";
import { deleteTimeLog } from "../services/timeLogs";
import { durationMinutes, safeNumber } from "../utils/formatters.js";

const safeString = (v) => (v == null ? null : String(v));
import { vfTime, vfNumber } from "../utils/vf";
import { base as rowBase, getField } from "../utils/rowAccess";
import { logError as maybeLogError } from "../utils/logError";

import LRPDataGrid from "./LRPDataGrid.jsx";
import EditTimeLogDialog from "./EditTimeLogDialog.jsx";

function logError(err, ctx) {
  if (typeof maybeLogError === "function") {
    maybeLogError(err, ctx);
  } else {
    console.error(ctx?.where || "AdminTimeLog", err);
  }
}

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ mt: 2 }}>{children}</Box>;
}

// Flatten {id, data:{…}} / {id, doc:{…}} to plain object with id + fields.
function normalizeRow(row) {
  if (!row || typeof row !== "object") return row;
  const b = rowBase(row);
  return { id: row.id || b?.id, ...b };
}

export default function AdminTimeLog() {
  const [tab, setTab] = useState(0);

  // ---- Time Logs state ----
  const [logRows, setLogRows] = useState([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logErr, setLogErr] = useState(null);
  const [editLog, setEditLog] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  // ---- Shootout sessions (raw) ----
  const [shootRows, setShootRows] = useState([]);
  const [shootLoading, setShootLoading] = useState(true);
  const [shootErr, setShootErr] = useState(null);

  // ---------- Subscriptions ----------
  useEffect(() => {
    setLogLoading(true);
    setLogErr(null);
    let unsub;
    try {
      unsub = subscribeTimeLogs(
        (rows) => {
          try {
            const list = Array.isArray(rows) ? rows.map(normalizeRow) : [];
            setLogRows(list);
            setLogLoading(false);
          } catch (e) {
            setLogLoading(false);
            setLogErr("Failed to map time logs");
            logError(e, { where: "AdminTimeLog: map timeLogs" });
          }
        },
        (err) => {
          setLogLoading(false);
          setLogErr(err?.message || "Failed to load time logs");
          logError(err, { where: "AdminTimeLog: subscribe timeLogs" });
        }
      );
    } catch (e) {
      setLogLoading(false);
      setLogErr(e?.message || "Failed to init time logs subscription");
      logError(e, { where: "AdminTimeLog: subscribe setup" });
    }
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    setShootLoading(true);
    setShootErr(null);
    let unsub;
    try {
      unsub = subscribeShootoutStats(
        (rows) => {
          try {
            const list = Array.isArray(rows) ? rows.map(normalizeRow) : [];
            setShootRows(list);
            setShootLoading(false);
          } catch (e) {
            setShootLoading(false);
            setShootErr("Failed to map shootout stats");
            logError(e, { where: "AdminTimeLog: map shootout" });
          }
        },
        (err) => {
          setShootLoading(false);
          setShootErr(err?.message || "Failed to load shootout stats");
          logError(err, { where: "AdminTimeLog: subscribe shootout" });
        }
      );
    } catch (e) {
      setShootLoading(false);
      setShootErr(e?.message || "Failed to init shootout subscription");
      logError(e, { where: "AdminTimeLog: subscribe shootout setup" });
    }
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // ---------- Weekly Summary (from timeLogs) ----------
  const weeklyRows = useMemo(() => {
    if (!Array.isArray(logRows)) return [];
    const map = new Map();
    for (const r of logRows) {
      const key = `${safeString(getField(r, "driverEmail"))}::${safeString(
        getField(r, "driver") ?? getField(r, "driverName")
      )}`;
      const start = getField(r, "startTime");
      const end = getField(r, "endTime");
      const explicit = getField(r, "duration");
      const dur = Number.isFinite(explicit) ? explicit : durationMinutes(start, end) ?? 0;

      const firstInSec = start?.seconds ?? Infinity;
      const lastOutSec = end?.seconds ?? -Infinity;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          driver: safeString(getField(r, "driver") ?? getField(r, "driverName")),
          driverEmail: safeString(getField(r, "driverEmail")),
          sessions: 0,
          minutes: 0,
          firstInSec,
          lastOutSec,
        });
      }
      const cur = map.get(key);
      cur.sessions += 1;
      cur.minutes += safeNumber(dur, 0);
      if (firstInSec < cur.firstInSec) cur.firstInSec = firstInSec;
      if (lastOutSec > cur.lastOutSec) cur.lastOutSec = lastOutSec;
    }
    return Array.from(map.values()).map((x) => ({
      ...x,
      firstIn: x.firstInSec === Infinity ? null : { seconds: x.firstInSec, nanoseconds: 0 },
      lastOut: x.lastOutSec === -Infinity ? null : { seconds: x.lastOutSec, nanoseconds: 0 },
    }));
  }, [logRows]);

  const weeklyColumns = useMemo(
    () => [
      { field: "driver", headerName: "Driver", minWidth: 160, flex: 0.8 },
      { field: "driverEmail", headerName: "Driver Email", minWidth: 220, flex: 1 },
      { field: "sessions", headerName: "Sessions", type: "number", minWidth: 120, flex: 0.5 },
      { field: "minutes", headerName: "Total Minutes", type: "number", minWidth: 140, flex: 0.6 },
      {
        field: "hours",
        headerName: "Total Hours",
        minWidth: 130,
        flex: 0.6,
        valueGetter: (p) => safeNumber(p?.row?.minutes, 0) / 60,
        valueFormatter: (p) => {
          const n = vfNumber(p, null);
          return n == null ? "N/A" : n.toFixed(2);
        },
      },
      {
        field: "firstIn",
        headerName: "First In",
        minWidth: 170,
        flex: 0.8,
        valueGetter: (p) => p?.row?.firstIn ?? null,
        valueFormatter: vfTime,
        sortComparator: (v1, v2, p1, p2) => {
          const a = p1?.row?.firstIn?.seconds ?? -1;
          const b = p2?.row?.firstIn?.seconds ?? -1;
          return a - b;
        },
      },
      {
        field: "lastOut",
        headerName: "Last Out",
        minWidth: 170,
        flex: 0.8,
        valueGetter: (p) => p?.row?.lastOut ?? null,
        valueFormatter: vfTime,
        sortComparator: (v1, v2, p1, p2) => {
          const a = p1?.row?.lastOut?.seconds ?? -1;
          const b = p2?.row?.lastOut?.seconds ?? -1;
          return a - b;
        },
      },
    ],
    []
  );

  // ---------- Shootout Summary (from shootoutStats) ----------
  // Group by driverEmail + vehicle; sum trips, passengers, minutes; derive firstStart/lastEnd
  const shootSummaryRows = useMemo(() => {
    if (!Array.isArray(shootRows)) return [];
    const map = new Map();
    for (const r of shootRows) {
      const driverEmail = safeString(getField(r, "driverEmail"));
      const vehicle = safeString(getField(r, "vehicle"));
      const key = `${driverEmail}::${vehicle}`;
      const start = getField(r, "startTime");
      const end = getField(r, "endTime");
      const trips = safeNumber(getField(r, "trips"), 0);
      const pax = safeNumber(getField(r, "passengers"), 0);
      const mins = durationMinutes(start, end) ?? 0;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          driverEmail,
          vehicle,
          sessions: 0,
          trips: 0,
          passengers: 0,
          minutes: 0,
          firstStartSec: start?.seconds ?? Infinity,
          lastEndSec: end?.seconds ?? -Infinity,
        });
      }
      const cur = map.get(key);
      cur.sessions += 1;
      cur.trips += trips;
      cur.passengers += pax;
      cur.minutes += mins;
      const s = start?.seconds ?? Infinity;
      const e = end?.seconds ?? -Infinity;
      if (s < cur.firstStartSec) cur.firstStartSec = s;
      if (e > cur.lastEndSec) cur.lastEndSec = e;
    }

    return Array.from(map.values()).map((x) => ({
      ...x,
      firstStart: x.firstStartSec === Infinity ? null : { seconds: x.firstStartSec, nanoseconds: 0 },
      lastEnd: x.lastEndSec === -Infinity ? null : { seconds: x.lastEndSec, nanoseconds: 0 },
    }));
  }, [shootRows]);

  const shootSummaryColumns = useMemo(
    () => [
      { field: "driverEmail", headerName: "Driver Email", minWidth: 220, flex: 1 },
      { field: "vehicle", headerName: "Vehicle", minWidth: 160, flex: 0.8 },
      { field: "sessions", headerName: "Sessions", type: "number", minWidth: 120, flex: 0.5 },
      { field: "trips", headerName: "Trips", type: "number", minWidth: 110, flex: 0.5 },
      { field: "passengers", headerName: "PAX", type: "number", minWidth: 110, flex: 0.5 },
      { field: "minutes", headerName: "Minutes", type: "number", minWidth: 120, flex: 0.5 },
      {
        field: "hours",
        headerName: "Hours",
        minWidth: 120,
        flex: 0.5,
        valueGetter: (p) => safeNumber(p?.row?.minutes, 0) / 60,
        valueFormatter: (p) => {
          const n = vfNumber(p, null);
          return n == null ? "N/A" : n.toFixed(2);
        },
      },
      {
        field: "firstStart",
        headerName: "First Start",
        minWidth: 170,
        flex: 0.8,
        valueGetter: (p) => p?.row?.firstStart ?? null,
        valueFormatter: vfTime,
        sortComparator: (v1, v2, p1, p2) => {
          const a = p1?.row?.firstStart?.seconds ?? -1;
          const b = p2?.row?.firstStart?.seconds ?? -1;
          return a - b;
        },
      },
      {
        field: "lastEnd",
        headerName: "Last End",
        minWidth: 170,
        flex: 0.8,
        valueGetter: (p) => p?.row?.lastEnd ?? null,
        valueFormatter: vfTime,
        sortComparator: (v1, v2, p1, p2) => {
          const a = p1?.row?.lastEnd?.seconds ?? -1;
          const b = p2?.row?.lastEnd?.seconds ?? -1;
          return a - b;
        },
      },
    ],
    []
  );

  const handleEditLog = useCallback((row) => {
    setEditLog(row);
    setEditOpen(true);
  }, []);

  const handleEditClose = useCallback(() => {
    setEditOpen(false);
    setEditLog(null);
  }, []);

  const handleDeleteLog = useCallback(async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Delete this time log?")) return;
    try {
      await deleteTimeLog(row.id);
    } catch (e) {
      logError(e, { where: "AdminTimeLog:delete timeLog" });
      alert("Failed to delete time log");
    }
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">Admin Time Logs</Typography>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        textColor="inherit"
        indicatorColor="primary"
        aria-label="Admin Time Log Tabs"
        sx={{ "& .MuiTab-root": { textTransform: "none", minHeight: 40 }, mb: 1 }}
      >
        <Tab label="Logs" />
        <Tab label="Weekly Summary" />
        <Tab label="Shootout Sessions" />
        <Tab label="Shootout Summary" />
      </Tabs>
      <Divider sx={{ mb: 1, opacity: 0.12 }} />

      {/* Logs */}
      <TabPanel value={tab} index={0}>
        <LRPDataGrid
          rows={logRows}
          columns={timeLogColumns({ withActions: true, onEdit: handleEditLog, onDelete: handleDeleteLog })}
          loading={logLoading}
          error={logErr}
          autoHeight
        />
        {editOpen && (
          <EditTimeLogDialog open={editOpen} log={editLog} onClose={handleEditClose} />
        )}
      </TabPanel>

      {/* Weekly Summary */}
      <TabPanel value={tab} index={1}>
        <LRPDataGrid rows={weeklyRows} columns={weeklyColumns} loading={logLoading} error={logErr} autoHeight />
      </TabPanel>

      {/* Shootout Sessions (raw) */}
      <TabPanel value={tab} index={2}>
        <LRPDataGrid rows={shootRows} columns={shootoutColumns()} loading={shootLoading} error={shootErr} autoHeight />
      </TabPanel>

      {/* Shootout Summary (aggregated) */}
      <TabPanel value={tab} index={3}>
        <LRPDataGrid
          rows={shootSummaryRows}
          columns={shootSummaryColumns}
          loading={shootLoading}
          error={shootErr}
          autoHeight
        />
      </TabPanel>
    </Box>
  );
}
