/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Tabs,
  Tab,
  TextField,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Tooltip,
  IconButton,
} from "@mui/material";
import { DatePicker, DateTimePicker } from "@mui/x-date-pickers";
import {
  DataGrid,
  GridToolbar,
  GridActionsCellItem,
} from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import PageContainer from "./PageContainer.jsx";
import {
  subscribeTimeLogs,
  subscribeShootoutStats,
  subscribeUserAccess, // if you have this already; else we gate on email === admin@…
} from "../hooks/api";
import { useAuth } from "../context/AuthContext.jsx";

// Firestore ops (update/delete) – uses your initialized db
import {
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
} from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "../utils/firebaseInit";

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Chicago";

/** ---------- Time helpers ---------- */
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
      const t = input.getTime();
      return Number.isFinite(t) ? t : null;
    }
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
function fromMsToTimestamp(ms) {
  return Number.isFinite(ms) ? Timestamp.fromMillis(ms) : null;
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

/** ---------- User directory (email → name) from userAccess ---------- */
function useUserDirectory() {
  const [map, setMap] = useState(() => new Map());
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "userAccess"), (snap) => {
      const next = new Map();
      snap.forEach((d) => {
        const data = d.data() || {};
        const email = (data.email || d.id || "").toLowerCase();
        const name = data.name || "";
        if (email) next.set(email, name);
      });
      setMap(next);
    });
    return () => unsub && unsub();
  }, []);
  const getName = useCallback(
    (email) => (email ? map.get(String(email).toLowerCase()) || "" : ""),
    [map],
  );
  return { getName };
}

/** ---------- Normalizers ---------- */
function normalizeTimeLog(r) {
  const startMs = toMs(r.startTime);
  const endMs = toMs(r.endTime);
  const durationMs =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
      ? endMs - startMs
      : Number.isFinite(r.duration)
      ? // if duration stored in minutes, keep it in ms
        (r.duration > 100000 ? r.duration : Math.floor(Number(r.duration) * 60 * 1000))
      : null;

  return {
    _col: "timeLogs",
    _id: r.id, // REAL Firestore id expected from subscribeTimeLogs
    id:
      r.id ??
      `${(r.driverEmail || r.driver || "row").toLowerCase()}-${startMs ?? toMs(r.loggedAt) ?? 0}-${endMs ?? 0}`,
    driverEmail: r.driverEmail || r.driver || "",
    vehicle: r.vehicle || r.rideId || "", // display
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
  const start = toMs(r.startTime);
  const end = toMs(r.endTime);
  return {
    _col: "shootoutStats",
    _id: r.id,
    id:
      r.id ??
      `${(r.driverEmail || "row").toLowerCase()}-${start ?? toMs(r.createdAt) ?? 0}-${end ?? 0}`,
    driverEmail: r.driverEmail || "",
    vehicle: r.vehicle || "",
    startTime: start,
    endTime: end,
    duration:
      Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null,
    trips: Number.isFinite(r.trips) ? r.trips : 0,
    passengers: Number.isFinite(r.passengers) ? r.passengers : 0,
    createdAt: toMs(r.createdAt),
    status: r.status || "",
    raw: r,
  };
}

/** ---------- Columns helpers ---------- */
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
  const { currentUser } = useAuth() || {};
  const myEmail = (currentUser?.email || "").toLowerCase();
  const { getName } = useUserDirectory();

  // ---- determine admin permission (from userAccess) ----
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let unsub;
    try {
      // live read of your record in userAccess
      if (myEmail) {
        unsub = onSnapshot(doc(db, "userAccess", myEmail), (snap) => {
          const access = (snap.data()?.access || "").toLowerCase();
          setIsAdmin(access === "admin");
        });
      }
    } catch (e) {
      console.error(e);
      setIsAdmin(false);
    }
    return () => unsub && unsub();
  }, [myEmail]);

  /** ---------------- Entries (timeLogs) ---------------- */
  const [rawTimeLogs, setRawTimeLogs] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entryError, setEntryError] = useState("");

  const [entrySearch, setEntrySearch] = useState("");
  const [entryDriver, setEntryDriver] = useState("");
  const [entryStartAfter, setEntryStartAfter] = useState(null);
  const [entryEndBefore, setEntryEndBefore] = useState(null);

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

  // inline update handler (only simple text/number fields inline)
  const processEntryUpdate = useCallback(
    async (newRow, oldRow) => {
      if (!isAdmin) return oldRow;
      if (!newRow?._id) return oldRow; // need real doc id
      const ref = doc(db, "timeLogs", newRow._id);

      // Map display fields back to schema: driver/driverEmail, rideId
      const patch = {};
      if (newRow.driverEmail !== oldRow.driverEmail) {
        patch.driver = String(newRow.driverEmail || "");
        patch.driverEmail = String(newRow.driverEmail || "");
      }
      if (newRow.vehicle !== oldRow.vehicle) {
        // In timeLogs, this is rideId (you don’t store vehicle here)
        patch.rideId = String(newRow.vehicle || "");
      }
      if (newRow.trips !== oldRow.trips) patch.trips = Number(newRow.trips || 0);
      if (newRow.passengers !== oldRow.passengers) patch.passengers = Number(newRow.passengers || 0);
      if (newRow.note !== oldRow.note) patch.note = String(newRow.note || "");

      if (Object.keys(patch).length) {
        await updateDoc(ref, patch);
      }
      return newRow;
    },
    [isAdmin]
  );

  const entryColumns = useMemo(
    () => [
      {
        field: "driverEmail",
        headerName: "Driver",
        flex: 1,
        minWidth: 180,
        editable: isAdmin,
        renderCell: (p) => {
          const email = p.row?.driverEmail || "";
          const name = getName(email);
          if (!name) return email;
          return (
            <Tooltip title={email}>
              <span>{name}</span>
            </Tooltip>
          );
        },
      },
      {
        field: "vehicle",
        headerName: "Vehicle / Ride",
        flex: 1,
        minWidth: 160,
        editable: isAdmin, // writes to rideId
      },
      startCol("startTime"),
      endCol("endTime"),
      durationCol("duration"),
      { field: "trips", headerName: "Trips", type: "number", width: 90, editable: isAdmin },
      { field: "passengers", headerName: "Pax", type: "number", width: 90, editable: isAdmin },
      { field: "note", headerName: "Note", flex: 1, minWidth: 160, editable: isAdmin },
      {
        field: "actions",
        type: "actions",
        headerName: "",
        width: 90,
        getActions: (params) => {
          const dis = !isAdmin || !params.row?._id;
          return [
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Edit times"
              disabled={dis}
              onClick={() => openEditModal(params.row)}
              showInMenu={false}
            />,
            <GridActionsCellItem
              key="del"
              icon={<DeleteIcon />}
              label="Delete"
              disabled={dis}
              onClick={() => handleDelete(params.row)}
              showInMenu={false}
            />,
          ];
        },
      },
    ],
    [isAdmin, getName]
  );

  const entryFiltered = useMemo(() => {
    return entryRows.filter((r) => {
      if (entryDriver) {
        const match =
          r.driverEmail.toLowerCase().includes(entryDriver.toLowerCase()) ||
          getName(r.driverEmail).toLowerCase().includes(entryDriver.toLowerCase());
        if (!match) return false;
      }
      const startDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      const endDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;
      if (entryStartAfter && (!startDj || !startDj.isAfter(entryStartAfter))) return false;
      if (entryEndBefore) {
        const compareDj = endDj || startDj;
        if (!compareDj || !compareDj.isBefore(entryEndBefore)) return false;
      }
      if (entrySearch) {
        const q = entrySearch.toLowerCase();
        const text = `${r.driverEmail} ${getName(r.driverEmail)} ${r.vehicle} ${r.note}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [entryRows, entryDriver, entryStartAfter, entryEndBefore, entrySearch, getName]);

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

  const processShootoutUpdate = useCallback(
    async (newRow, oldRow) => {
      if (!isAdmin) return oldRow;
      if (!newRow?._id) return oldRow;
      const ref = doc(db, "shootoutStats", newRow._id);

      const patch = {};
      if (newRow.driverEmail !== oldRow.driverEmail)
        patch.driverEmail = String(newRow.driverEmail || "");
      if (newRow.vehicle !== oldRow.vehicle) patch.vehicle = String(newRow.vehicle || "");
      if (newRow.trips !== oldRow.trips) patch.trips = Number(newRow.trips || 0);
      if (newRow.passengers !== oldRow.passengers)
        patch.passengers = Number(newRow.passengers || 0);
      if (newRow.status !== oldRow.status) patch.status = String(newRow.status || "");

      if (Object.keys(patch).length) await updateDoc(ref, patch);
      return newRow;
    },
    [isAdmin]
  );

  const shootoutColumns = useMemo(
    () => [
      {
        field: "driverEmail",
        headerName: "Driver",
        flex: 1,
        minWidth: 180,
        editable: isAdmin,
        renderCell: (p) => {
          const email = p.row?.driverEmail || "";
          const name = getName(email);
          if (!name) return email;
          return <Tooltip title={email}><span>{name}</span></Tooltip>;
        },
      },
      { field: "vehicle", headerName: "Vehicle", flex: 1, minWidth: 140, editable: isAdmin },
      startCol("startTime"),
      endCol("endTime"),
      durationCol("duration"),
      { field: "trips", headerName: "Trips", type: "number", width: 90, editable: isAdmin },
      { field: "passengers", headerName: "Pax", type: "number", width: 90, editable: isAdmin },
      { field: "status", headerName: "Status", width: 120, editable: isAdmin },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 170,
        valueGetter: (p) => p?.row?.createdAt,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
      },
      {
        field: "actions",
        type: "actions",
        headerName: "",
        width: 90,
        getActions: (params) => {
          const dis = !isAdmin || !params.row?._id;
          return [
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Edit times"
              disabled={dis}
              onClick={() => openEditModal(params.row)}
              showInMenu={false}
            />,
            <GridActionsCellItem
              key="del"
              icon={<DeleteIcon />}
              label="Delete"
              disabled={dis}
              onClick={() => handleDelete(params.row)}
              showInMenu={false}
            />,
          ];
        },
      },
    ],
    [isAdmin, getName]
  );

  const shootFiltered = useMemo(() => {
    return shootoutRows.filter((r) => {
      if (shootDriver) {
        const match =
          r.driverEmail.toLowerCase().includes(shootDriver.toLowerCase()) ||
          getName(r.driverEmail).toLowerCase().includes(shootDriver.toLowerCase());
        if (!match) return false;
      }
      const startDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      const endDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;
      if (shootStartAfter && (!startDj || !startDj.isAfter(shootStartAfter))) return false;
      if (shootEndBefore) {
        const compareDj = endDj || startDj;
        if (!compareDj || !compareDj.isBefore(shootEndBefore)) return false;
      }
      if (shootSearch) {
        const q = shootSearch.toLowerCase();
        const text = `${r.driverEmail} ${getName(r.driverEmail)} ${r.vehicle} ${r.status}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [shootoutRows, shootDriver, shootStartAfter, shootEndBefore, shootSearch, getName]);

  /** ---------------- Weekly Summary (unchanged) ---------------- */
  const [tab, setTab] = useState(0);
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const weekEnd = useMemo(() => weekStart.add(1, "week"), [weekStart]);

  const weekly = useMemo(() => {
    const inWeek = entryRows.filter((r) => {
      const s = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      if (!s) return false;
      return (s.isAfter(weekStart) || s.isSame(weekStart)) && s.isBefore(weekEnd);
    });
    const byDriver = new Map();
    for (const r of inWeek) {
      const key = r.driverEmail || "Unknown";
      const prev = byDriver.get(key) || {
        driver: getName(key) || key,
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
  }, [entryRows, weekStart, weekEnd, getName]);

  /** ---------------- Edit Modal (times) ---------------- */
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const openEditModal = (row) => {
    setEditRow(row);
    setEditOpen(true);
  };
  const closeEditModal = () => {
    setEditOpen(false);
    setEditRow(null);
  };
  const saveEditModal = async () => {
    try {
      if (!isAdmin || !editRow?._id) return;
      const ref = doc(db, editRow._col, editRow._id);
      const patch = {};
      if (Number.isFinite(editRow.startTime))
        patch.startTime = fromMsToTimestamp(editRow.startTime);
      if (Number.isFinite(editRow.endTime))
        patch.endTime = fromMsToTimestamp(editRow.endTime);
      // recompute duration field if this is timeLogs and you store it
      if (editRow._col === "timeLogs") {
        if (Number.isFinite(editRow.startTime) && Number.isFinite(editRow.endTime)) {
          patch.duration = Math.max(0, Math.floor((editRow.endTime - editRow.startTime)));
        }
      }
      await updateDoc(ref, patch);
    } catch (e) {
      console.error(e);
    } finally {
      closeEditModal();
    }
  };

  /** ---------------- Delete ---------------- */
  const handleDelete = async (row) => {
    try {
      if (!isAdmin || !row?._id) return;
      const ok = window.confirm("Delete this record?");
      if (!ok) return;
      await deleteDoc(doc(db, row._col, row._id));
    } catch (e) {
      console.error(e);
    }
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
            editMode="row"
            processRowUpdate={processEntryUpdate}
            onProcessRowUpdateError={(e) => console.error(e)}
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
            editMode="row"
            processRowUpdate={processShootoutUpdate}
            onProcessRowUpdateError={(e) => console.error(e)}
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

      {/* Edit modal for Start/End */}
      <Dialog open={editOpen} onClose={closeEditModal} fullWidth maxWidth="sm">
        <DialogTitle>Edit times</DialogTitle>
        <DialogContent>
          {editRow && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Driver (email)"
                value={editRow.driverEmail || ""}
                onChange={(e) => setEditRow((r) => ({ ...r, driverEmail: e.target.value }))}
                size="small"
                disabled={!isAdmin}
              />
              <TextField
                label={editRow._col === "timeLogs" ? "Ride ID" : "Vehicle"}
                value={editRow.vehicle || ""}
                onChange={(e) => setEditRow((r) => ({ ...r, vehicle: e.target.value }))}
                size="small"
                disabled={!isAdmin}
              />
              <DateTimePicker
                label="Start time"
                value={Number.isFinite(editRow.startTime) ? dayjs(editRow.startTime) : null}
                onChange={(v) =>
                  setEditRow((r) => ({ ...r, startTime: v ? v.valueOf() : null }))
                }
                slotProps={{ textField: { size: "small" } }}
              />
              <DateTimePicker
                label="End time"
                value={Number.isFinite(editRow.endTime) ? dayjs(editRow.endTime) : null}
                onChange={(v) =>
                  setEditRow((r) => ({ ...r, endTime: v ? v.valueOf() : null }))
                }
                slotProps={{ textField: { size: "small" } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditModal}>Cancel</Button>
          <Button onClick={saveEditModal} disabled={!isAdmin} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
