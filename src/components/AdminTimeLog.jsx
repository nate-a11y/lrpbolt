/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Tabs, Tab, TextField, Typography, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Stack, Tooltip, IconButton
} from "@mui/material";
import { DatePicker, DateTimePicker } from "@mui/x-date-pickers";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import PageContainer from "./PageContainer.jsx";
import { subscribeTimeLogs, subscribeShootoutStats } from "../hooks/api";

import { doc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "../utils/firebaseInit";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Chicago";

/* ---------------- helpers ---------------- */
const isEmail = (s) => typeof s === "string" && s.includes("@");

function toMs(input) {
  if (input == null) return null;
  try {
    if (typeof input === "object" && typeof input.toDate === "function") {
      const t = input.toDate().getTime();
      return Number.isFinite(t) ? t : null;
    }
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
    if (input instanceof Date) {
      const t = input.getTime(); return Number.isFinite(t) ? t : null;
    }
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (typeof input === "string") {
      const n = Number(input); if (Number.isFinite(n)) return n;
      const t = Date.parse(input); return Number.isFinite(t) ? t : null;
    }
  } catch {}
  return null;
}
function fmtDateTimeMs(ms) {
  if (!Number.isFinite(ms)) return "";
  return dayjs.tz(ms, TZ).format("MMM D, h:mm A");
}
function fmtMinutes(min) {
  if (!Number.isFinite(min) || min < 0) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
const asInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : d;
};

/* ---------------- live name map from users + userAccess ---------------- */
function useNameMap() {
  const [map, setMap] = useState({});
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const next = {};
      snap.forEach((d) => {
        const data = d.data() || {};
        const email = (data.email || d.id || "").toLowerCase();
        const name = data.name || data.displayName || data.fullName || "";
        if (email) next[email] = name;
      });
      setMap((prev) => ({ ...prev, ...next }));
    });
    const unsubAccess = onSnapshot(collection(db, "userAccess"), (snap) => {
      const next = {};
      snap.forEach((d) => {
        const data = d.data() || {};
        const email = (data.email || d.id || "").toLowerCase();
        const name = data.name || data.displayName || data.fullName || "";
        if (email && name) next[email] = name;
      });
      setMap((prev) => ({ ...prev, ...next }));
    });
    return () => { unsubUsers && unsubUsers(); unsubAccess && unsubAccess(); };
  }, []);
  return map;
}

/* ---------------- normalizers (strict to each collection) ---------------- */
// timeLogs fields: driver (string), duration (minutes), endTime (ts), loggedAt (ts), rideId (string), startTime (ts)
function normalizeTimeLog(r) {
  const startMs = toMs(r.startTime);
  const endMs = toMs(r.endTime);
  const durMin = Number.isFinite(r.duration)
    ? Number(r.duration)
    : Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
    ? Math.round((endMs - startMs) / 60000)
    : null;
  const realId = r.id || r._id || r.docId || null;
  return {
    _col: "timeLogs",
    _id: realId,
    id: realId ?? `${(r.driver || "row").toLowerCase()}-${startMs ?? toMs(r.loggedAt) ?? 0}-${endMs ?? 0}`,
    driver: r.driver || "",
    rideId: r.rideId || "",
    startTime: startMs,
    endTime: endMs,
    durationMin: durMin,
    loggedAt: toMs(r.loggedAt),
  };
}

// shootoutStats fields: driverEmail, vehicle, startTime, endTime, trips, passengers, createdAt
function normalizeShootout(r) {
  const realId = r.id || r._id || r.docId || null;
  return {
    _col: "shootoutStats",
    _id: realId,
    id: realId ?? `${(r.driverEmail || "row").toLowerCase()}-${toMs(r.startTime) ?? 0}`,
    driverEmail: r.driverEmail || "",
    vehicle: r.vehicle || "",
    startTime: toMs(r.startTime),
    endTime: toMs(r.endTime),
    trips: Number.isFinite(r.trips) ? r.trips : 0,
    passengers: Number.isFinite(r.passengers) ? r.passengers : 0,
    createdAt: toMs(r.createdAt),
  };
}

/* ---------------- custom edit cells ---------------- */
function DateTimeEditCell(props) {
  const { id, field, value, api } = props;
  const v = Number.isFinite(value) ? dayjs(value) : null;
  return (
    <DateTimePicker
      value={v}
      onChange={(nv) => {
        api.setEditCellValue({ id, field, value: nv ? nv.valueOf() : null }, event);
      }}
      ampm
      slotProps={{ textField: { size: "small" } }}
    />
  );
}
function NumberEditCell(props) {
  const { id, field, value, api } = props;
  return (
    <TextField
      size="small"
      type="number"
      value={value ?? ""}
      onChange={(e) => api.setEditCellValue({ id, field, value: e.target.value }, event)}
      inputProps={{ step: 1 }}
      fullWidth
    />
  );
}

/* ---------------- component ---------------- */
export default function AdminTimeLog() {
  const nameMap = useNameMap();
  const refFor = (row) => doc(db, row._col, row._id || row.id);

  /* -------- Entries -------- */
  const [rawTimeLogs, setRawTimeLogs] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entryError, setEntryError] = useState("");

  const [entrySearch, setEntrySearch] = useState("");
  const [entryDriver, setEntryDriver] = useState("");
  const [entryStartAfter, setEntryStartAfter] = useState(null);
  const [entryEndBefore, setEntryEndBefore] = useState(null);

  useEffect(() => {
    const unsub = subscribeTimeLogs(
      (rows) => { setRawTimeLogs(Array.isArray(rows) ? rows : []); setLoadingEntries(false); },
      (e) => { console.error(e); setEntryError("Failed to load time logs."); setLoadingEntries(false); }
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const entryRows = useMemo(
    () => (Array.isArray(rawTimeLogs) ? rawTimeLogs.map(normalizeTimeLog) : []),
    [rawTimeLogs]
  );

  // Inline commit for ALL fields in timeLogs
  const onEntryCellEditCommit = async (params) => {
    const { id, field, value } = params;
    const row = entryRows.find((r) => r.id === id);
    if (!row) return;
    const ref = doc(db, "timeLogs", row._id || row.id);
    const patch = {};

    if (field === "driver") patch.driver = String(value || "");
    else if (field === "rideId") patch.rideId = String(value || "");
    else if (field === "startTime") patch.startTime = value ? Timestamp.fromMillis(Number(value)) : null;
    else if (field === "endTime") patch.endTime = value ? Timestamp.fromMillis(Number(value)) : null;
    else if (field === "durationMin") patch.duration = asInt(value, 0); // stored as minutes
    else if (field === "loggedAt") patch.loggedAt = value ? Timestamp.fromMillis(Number(value)) : null;

    // If start/end changed, recompute duration minutes here to keep consistent
    if (("startTime" in patch) || ("endTime" in patch)) {
      const s = ("startTime" in patch) ? (patch.startTime ? patch.startTime.toMillis() : null) : row.startTime;
      const e = ("endTime" in patch) ? (patch.endTime ? patch.endTime.toMillis() : null) : row.endTime;
      if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
        patch.duration = Math.round((e - s) / 60000);
      }
    }

    if (Object.keys(patch).length) await updateDoc(ref, patch);
  };

  const entryFiltered = useMemo(() => {
    return entryRows.filter((r) => {
      if (entryDriver) {
        const disp = isEmail(r.driver) ? (nameMap[r.driver.toLowerCase()] || r.driver) : r.driver;
        const hay = `${r.driver} ${disp}`.toLowerCase();
        if (!hay.includes(entryDriver.toLowerCase())) return false;
      }
      const sDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      const eDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;
      if (entryStartAfter && (!sDj || !sDj.isAfter(entryStartAfter))) return false;
      if (entryEndBefore) { const cmp = eDj || sDj; if (!cmp || !cmp.isBefore(entryEndBefore)) return false; }
      if (entrySearch) {
        const text = [r.driver, isEmail(r.driver) ? nameMap[r.driver.toLowerCase()] || "" : "", r.rideId].join(" ").toLowerCase();
        if (!text.includes(entrySearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [entryRows, entryDriver, entryStartAfter, entryEndBefore, entrySearch, nameMap]);

  /* -------- Shootout -------- */
  const [rawShootout, setRawShootout] = useState([]);
  const [loadingShootout, setLoadingShootout] = useState(true);
  const [shootError, setShootError] = useState("");

  const [shootSearch, setShootSearch] = useState("");
  const [shootDriver, setShootDriver] = useState("");
  const [shootStartAfter, setShootStartAfter] = useState(null);
  const [shootEndBefore, setShootEndBefore] = useState(null);

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      (rows) => { setRawShootout(Array.isArray(rows) ? rows : []); setLoadingShootout(false); },
      (e) => { console.error(e); setShootError("Failed to load shootout stats."); setLoadingShootout(false); }
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const shootoutRows = useMemo(
    () => (Array.isArray(rawShootout) ? rawShootout.map(normalizeShootout) : []),
    [rawShootout]
  );

  // Inline commit for ALL fields in shootoutStats
  const onShootCellEditCommit = async (params) => {
    const { id, field, value } = params;
    const row = shootoutRows.find((r) => r.id === id);
    if (!row) return;
    const ref = doc(db, "shootoutStats", row._id || row.id);
    const patch = {};

    if (field === "driverEmail") patch.driverEmail = String(value || "");
    else if (field === "vehicle") patch.vehicle = String(value || "");
    else if (field === "trips") patch.trips = asInt(value, 0);
    else if (field === "passengers") patch.passengers = asInt(value, 0);
    else if (field === "startTime") patch.startTime = value ? Timestamp.fromMillis(Number(value)) : null;
    else if (field === "endTime") patch.endTime = value ? Timestamp.fromMillis(Number(value)) : null;
    else if (field === "createdAt") patch.createdAt = value ? Timestamp.fromMillis(Number(value)) : null;

    if (Object.keys(patch).length) await updateDoc(ref, patch);
  };

  /* -------- Modal (edit ALL fields for the selected row) -------- */
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const openEditModal = (row) => { setEditRow(row); setEditOpen(true); };
  const closeEditModal = () => { setEditOpen(false); setEditRow(null); };

  const setEdit = (k, v) => setEditRow((r) => ({ ...r, [k]: v }));

  const saveEditModal = async () => {
    if (!(editRow?._id || editRow?.id)) return;
    const ref = refFor(editRow);
    const patch = {};
    if (editRow._col === "timeLogs") {
      if ("driver" in editRow) patch.driver = String(editRow.driver || "");
      if ("rideId" in editRow) patch.rideId = String(editRow.rideId || "");
      if ("startTime" in editRow) patch.startTime = Number.isFinite(editRow.startTime) ? Timestamp.fromMillis(editRow.startTime) : null;
      if ("endTime" in editRow) patch.endTime = Number.isFinite(editRow.endTime) ? Timestamp.fromMillis(editRow.endTime) : null;
      if ("loggedAt" in editRow) patch.loggedAt = Number.isFinite(editRow.loggedAt) ? Timestamp.fromMillis(editRow.loggedAt) : null;
      if ("durationMin" in editRow) patch.duration = asInt(editRow.durationMin, 0);
      // keep duration in sync if both times present
      if (Number.isFinite(editRow.startTime) && Number.isFinite(editRow.endTime)) {
        patch.duration = Math.round((editRow.endTime - editRow.startTime) / 60000);
      }
    } else if (editRow._col === "shootoutStats") {
      if ("driverEmail" in editRow) patch.driverEmail = String(editRow.driverEmail || "");
      if ("vehicle" in editRow) patch.vehicle = String(editRow.vehicle || "");
      if ("trips" in editRow) patch.trips = asInt(editRow.trips, 0);
      if ("passengers" in editRow) patch.passengers = asInt(editRow.passengers, 0);
      if ("startTime" in editRow) patch.startTime = Number.isFinite(editRow.startTime) ? Timestamp.fromMillis(editRow.startTime) : null;
      if ("endTime" in editRow) patch.endTime = Number.isFinite(editRow.endTime) ? Timestamp.fromMillis(editRow.endTime) : null;
      if ("createdAt" in editRow) patch.createdAt = Number.isFinite(editRow.createdAt) ? Timestamp.fromMillis(editRow.createdAt) : null;
    }
    await updateDoc(ref, patch);
    setEditOpen(false);
  };

  const handleDelete = async (row) => {
    if (!(row?._id || row?.id)) return;
    if (!window.confirm("Delete this record?")) return;
    await deleteDoc(refFor(row));
  };

  /* -------- Columns (all fields editable) -------- */
  const entryColumns = useMemo(
    () => [
      {
        field: "driver",
        headerName: "Driver",
        flex: 1,
        minWidth: 180,
        editable: true,
        renderCell: (p) => {
          const d = p.row?.driver || "";
          if (!isEmail(d)) return d || "";
          const name = nameMap[d.toLowerCase()];
          return name ? <Tooltip title={d}><span>{name}</span></Tooltip> : d;
        },
      },
      { field: "rideId", headerName: "Ride ID", flex: 0.9, minWidth: 140, editable: true },
      {
        field: "startTime", headerName: "Start", flex: 1, minWidth: 160, editable: true,
        valueGetter: (p) => p?.row?.startTime,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
        renderCell: (p) => fmtDateTimeMs(p?.row?.startTime),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "endTime", headerName: "End", flex: 1, minWidth: 160, editable: true,
        valueGetter: (p) => p?.row?.endTime,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
        renderCell: (p) => fmtDateTimeMs(p?.row?.endTime),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "durationMin", headerName: "Duration", width: 120, editable: true,
        valueFormatter: (p) => fmtMinutes(p?.value),
        renderEditCell: (params) => <NumberEditCell {...params} />,
        sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "loggedAt", headerName: "Logged At", flex: 0.9, minWidth: 160, editable: true,
        valueGetter: (p) => p?.row?.loggedAt,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
        renderCell: (p) => fmtDateTimeMs(p?.row?.loggedAt),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "__actions",
        headerName: "",
        width: 96,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const row = p.row;
          const dis = !(row?._id || row?.id);
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton size="small" disabled={dis} onClick={() => openEditModal(row)}><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" disabled={dis} onClick={() => handleDelete(row)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          );
        },
      },
    ],
    [nameMap]
  );

  const shootoutColumns = useMemo(
    () => [
      {
        field: "driverEmail", headerName: "Driver", flex: 1, minWidth: 180, editable: true,
        renderCell: (p) => {
          const email = p.row?.driverEmail || "";
          const name = email ? nameMap[email.toLowerCase()] : "";
          return name ? <Tooltip title={email}><span>{name}</span></Tooltip> : email;
        },
      },
      { field: "vehicle", headerName: "Vehicle", flex: 1, minWidth: 140, editable: true },
      {
        field: "startTime", headerName: "Start", flex: 1, minWidth: 160, editable: true,
        valueGetter: (p) => p?.row?.startTime,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
        renderCell: (p) => fmtDateTimeMs(p?.row?.startTime),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "endTime", headerName: "End", flex: 1, minWidth: 160, editable: true,
        valueGetter: (p) => p?.row?.endTime,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
        renderCell: (p) => fmtDateTimeMs(p?.row?.endTime),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      { field: "trips", headerName: "Trips", type: "number", width: 110, editable: true, renderEditCell: (p) => <NumberEditCell {...p} /> },
      { field: "passengers", headerName: "Pax", type: "number", width: 110, editable: true, renderEditCell: (p) => <NumberEditCell {...p} /> },
      {
        field: "createdAt", headerName: "Created", flex: 0.9, minWidth: 170, editable: true,
        valueGetter: (p) => p?.row?.createdAt,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
        renderCell: (p) => fmtDateTimeMs(p?.row?.createdAt),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) => (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "__actions",
        headerName: "",
        width: 96,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const row = p.row;
          const dis = !(row?._id || row?.id);
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton size="small" disabled={dis} onClick={() => openEditModal(row)}><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" disabled={dis} onClick={() => handleDelete(row)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          );
        },
      },
    ],
    [nameMap]
  );

  /* -------- Weekly Summary (unchanged; uses entryRows) -------- */
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const weekEnd = useMemo(() => weekStart.add(1, "week"), [weekStart]);
  const weekly = useMemo(() => {
    const inWeek = entryRows.filter((r) => {
      const s = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      if (!s) return false;
      return (s.isAfter(weekStart) || s.isSame(weekStart)) && s.isBefore(weekEnd);
    });
    const by = new Map();
    for (const r of inWeek) {
      const key = isEmail(r.driver) ? r.driver.toLowerCase() : r.driver || "Unknown";
      const prev = by.get(key) || { driver: isEmail(key) ? nameMap[key] || key : key, sessions: 0, min: 0 };
      prev.sessions += 1;
      prev.min += Number.isFinite(r.durationMin) ? r.durationMin : 0;
      by.set(key, prev);
    }
    return Array.from(by.values()).map((v, i) => ({ id: i, driver: v.driver, sessions: v.sessions, hours: Number((v.min / 60).toFixed(2)) }));
  }, [entryRows, weekStart, weekEnd, nameMap]);

  return (
    <PageContainer pt={2} pb={4}>
      <Box sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Entries" />
          <Tab label="Weekly Summary" />
          <Tab label="Shootout Stats" />
        </Tabs>
      </Box>

      {/* Entries */}
      {tab === 0 && (
        <Box>
          {entryError && <Alert severity="error">{entryError}</Alert>}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <TextField label="Search" value={entrySearch} onChange={(e) => setEntrySearch(e.target.value)} size="small" />
            <TextField label="Driver" value={entryDriver} onChange={(e) => setEntryDriver(e.target.value)} size="small" />
            <DatePicker label="Start after" value={entryStartAfter} onChange={(v) => setEntryStartAfter(v)} slotProps={{ textField: { size: "small" } }} />
            <DatePicker label="End before" value={entryEndBefore} onChange={(v) => setEntryEndBefore(v)} slotProps={{ textField: { size: "small" } }} />
          </Box>
          <DataGrid
            autoHeight density="compact"
            rows={entryFiltered} columns={entryColumns}
            getRowId={(r) => r._id || r.id}
            loading={!!loadingEntries}
            disableRowSelectionOnClick
            editMode="cell"
            onCellEditCommit={onEntryCellEditCommit}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } }}
            initialState={{
              sorting: { sortModel: [{ field: "startTime", sort: "desc" }] },
              pagination: { paginationModel: { pageSize: 10 } },
            }}
          />
        </Box>
      )}

      {/* Weekly */}
      {tab === 1 && (
        <Box>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <DatePicker label="Week of" value={weekStart} onChange={(v) => v && setWeekStart(v.startOf("week"))} slotProps={{ textField: { size: "small" } }} />
          </Box>
          {weekly.length === 0 ? (
            <Typography variant="body2">No data for selected week.</Typography>
          ) : (
            <DataGrid
              autoHeight density="compact"
              rows={weekly}
              columns={[
                { field: "driver", headerName: "Driver", flex: 1 },
                { field: "sessions", headerName: "Sessions", width: 120, type: "number" },
                { field: "hours", headerName: "Hours", width: 110, type: "number" },
              ]}
              hideFooterSelectedRowCount
              initialState={{ sorting: { sortModel: [{ field: "hours", sort: "desc" }] }, pagination: { paginationModel: { pageSize: 10 } } }}
            />
          )}
        </Box>
      )}

      {/* Shootout */}
      {tab === 2 && (
        <Box>
          {shootError && <Alert severity="error">{shootError}</Alert>}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <TextField label="Search" value={shootSearch} onChange={(e) => setShootSearch(e.target.value)} size="small" />
            <TextField label="Driver" value={shootDriver} onChange={(e) => setShootDriver(e.target.value)} size="small" />
            <DatePicker label="Start after" value={shootStartAfter} onChange={(v) => setShootStartAfter(v)} slotProps={{ textField: { size: "small" } }} />
            <DatePicker label="End before" value={shootEndBefore} onChange={(v) => setShootEndBefore(v)} slotProps={{ textField: { size: "small" } }} />
          </Box>
          <DataGrid
            autoHeight density="compact"
            rows={shootoutRows.filter((r) => {
              if (shootDriver) {
                const disp = nameMap[r.driverEmail.toLowerCase()] || r.driverEmail;
                const hay = `${r.driverEmail} ${disp}`.toLowerCase();
                if (!hay.includes(shootDriver.toLowerCase())) return false;
              }
              const sDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
              const eDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;
              if (shootStartAfter && (!sDj || !sDj.isAfter(shootStartAfter))) return false;
              if (shootEndBefore) { const cmp = eDj || sDj; if (!cmp || !cmp.isBefore(shootEndBefore)) return false; }
              if (shootSearch) {
                const text = `${r.driverEmail} ${nameMap[r.driverEmail.toLowerCase()] || ""} ${r.vehicle}`.toLowerCase();
                if (!text.includes(shootSearch.toLowerCase())) return false;
              }
              return true;
            })}
            columns={shootoutColumns}
            getRowId={(r) => r._id || r.id}
            loading={!!loadingShootout}
            disableRowSelectionOnClick
            editMode="cell"
            onCellEditCommit={onShootCellEditCommit}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } } }}
            initialState={{
              sorting: { sortModel: [{ field: "startTime", sort: "desc" }] },
              pagination: { paginationModel: { pageSize: 10 } },
            }}
          />
        </Box>
      )}

      {/* Edit ALL fields modal */}
      <Dialog open={editOpen} onClose={closeEditModal} fullWidth maxWidth="sm">
        <DialogTitle>Edit record</DialogTitle>
        <DialogContent>
          {editRow && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {editRow._col === "timeLogs" ? (
                <>
                  <TextField label="Driver" value={editRow.driver ?? ""} onChange={(e) => setEdit("driver", e.target.value)} size="small" />
                  <TextField label="Ride ID" value={editRow.rideId ?? ""} onChange={(e) => setEdit("rideId", e.target.value)} size="small" />
                  <DateTimePicker label="Start time" value={Number.isFinite(editRow.startTime) ? dayjs(editRow.startTime) : null} onChange={(v) => setEdit("startTime", v ? v.valueOf() : null)} slotProps={{ textField: { size: "small" } }} />
                  <DateTimePicker label="End time" value={Number.isFinite(editRow.endTime) ? dayjs(editRow.endTime) : null} onChange={(v) => setEdit("endTime", v ? v.valueOf() : null)} slotProps={{ textField: { size: "small" } }} />
                  <TextField label="Duration (minutes)" type="number" value={editRow.durationMin ?? ""} onChange={(e) => setEdit("durationMin", asInt(e.target.value))} size="small" />
                  <DateTimePicker label="Logged At" value={Number.isFinite(editRow.loggedAt) ? dayjs(editRow.loggedAt) : null} onChange={(v) => setEdit("loggedAt", v ? v.valueOf() : null)} slotProps={{ textField: { size: "small" } }} />
                </>
              ) : (
                <>
                  <TextField label="Driver Email" value={editRow.driverEmail ?? ""} onChange={(e) => setEdit("driverEmail", e.target.value)} size="small" />
                  <TextField label="Vehicle" value={editRow.vehicle ?? ""} onChange={(e) => setEdit("vehicle", e.target.value)} size="small" />
                  <DateTimePicker label="Start time" value={Number.isFinite(editRow.startTime) ? dayjs(editRow.startTime) : null} onChange={(v) => setEdit("startTime", v ? v.valueOf() : null)} slotProps={{ textField: { size: "small" } }} />
                  <DateTimePicker label="End time" value={Number.isFinite(editRow.endTime) ? dayjs(editRow.endTime) : null} onChange={(v) => setEdit("endTime", v ? v.valueOf() : null)} slotProps={{ textField: { size: "small" } }} />
                  <TextField label="Trips" type="number" value={editRow.trips ?? ""} onChange={(e) => setEdit("trips", asInt(e.target.value))} size="small" />
                  <TextField label="Passengers" type="number" value={editRow.passengers ?? ""} onChange={(e) => setEdit("passengers", asInt(e.target.value))} size="small" />
                  <DateTimePicker label="Created At" value={Number.isFinite(editRow.createdAt) ? dayjs(editRow.createdAt) : null} onChange={(v) => setEdit("createdAt", v ? v.valueOf() : null)} slotProps={{ textField: { size: "small" } }} />
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditModal}>Cancel</Button>
          <Button onClick={saveEditModal} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
