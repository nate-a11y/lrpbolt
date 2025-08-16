/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
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
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import PageContainer from "./PageContainer.jsx";
import { subscribeTimeLogs, subscribeShootoutStats } from "../hooks/api";

// Firestore ops (update/delete) – uses your initialized db
import { doc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
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

/** ---------- Driver name lookup ---------- */
function useNameMap() {
  const [map, setMap] = useState({});
  useEffect(() => {
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, "users"));
        const next = {};
        snap.forEach((d) => {
          const data = d.data() || {};
          const email = (data.email || d.id || "").toLowerCase();
          const name = data.name || data.displayName || "";
          if (email) next[email] = name;
        });
        setMap(next);
      } catch (e) {
        console.error(e);
      }
    }
    fetchUsers();
  }, []);
  return map;
}

/** ---------- Normalizers ---------- */
function normalizeTimeLog(r) {
  const startMs = toMs(r.startTime);
  const endMs = toMs(r.endTime);
  const realId = r.id || r._id || r.docId || r.uid || r.key || null;
  const durationMs =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
      ? endMs - startMs
      : Number.isFinite(r.duration)
      ? r.duration > 100000
        ? r.duration
        : Math.floor(Number(r.duration) * 60 * 1000)
      : null;

  return {
    _col: "timeLogs",
    _id: realId,
    id:
      realId ??
      `${(r.driverEmail || r.driver || "row").toLowerCase()}-${
        startMs ?? toMs(r.loggedAt) ?? 0
      }-${endMs ?? 0}`,
    driverEmail: r.driverEmail || r.driver || "",
    vehicle: r.vehicle || r.rideId || "",
    startTime: startMs,
    endTime: endMs,
    duration: durationMs,
    trips: Number.isFinite(r.trips) ? r.trips : 0,
    passengers: Number.isFinite(r.passengers) ? r.passengers : 0,
    note: r.note || "",
  };
}

function normalizeShootout(r) {
  const start = toMs(r.startTime);
  const end = toMs(r.endTime);
  const realId = r.id || r._id || r.docId || r.uid || r.key || null;
  return {
    _col: "shootoutStats",
    _id: realId,
    id:
      realId ??
      `${(r.driverEmail || "row").toLowerCase()}-${
        start ?? toMs(r.createdAt) ?? 0
      }-${end ?? 0}`,
    driverEmail: r.driverEmail || "",
    vehicle: r.vehicle || "",
    startTime: start,
    endTime: end,
    duration:
      Number.isFinite(start) && Number.isFinite(end) && end >= start
        ? end - start
        : null,
    trips: Number.isFinite(r.trips) ? r.trips : 0,
    passengers: Number.isFinite(r.passengers) ? r.passengers : 0,
    createdAt: toMs(r.createdAt),
    status: r.status || "",
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
  sortComparator: (a, b) =>
    (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
});
const endCol = (field = "endTime") => ({
  field,
  headerName: "End",
  flex: 1,
  minWidth: 160,
  valueGetter: (p) => p?.row?.[field],
  valueFormatter: (p) => fmtDateTimeMs(p?.value),
  renderCell: (p) => fmtDateTimeMs(p?.row?.[field]),
  sortComparator: (a, b) =>
    (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
});
const durationCol = (field = "duration") => ({
  field,
  headerName: "Duration",
  flex: 0.6,
  minWidth: 120,
  valueGetter: (p) => p?.row?.[field] ?? null,
  valueFormatter: (p) => fmtDuration(p?.value),
  renderCell: (p) => fmtDuration(p?.row?.[field]),
  sortComparator: (a, b) =>
    (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
});

const actionsCol = (openEditModal, handleDelete) => ({
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
        <IconButton
          size="small"
          disabled={dis}
          onClick={() => openEditModal(row)}
        >
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={dis}
          onClick={() => handleDelete(row)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  },
});

export default function AdminTimeLog() {
  const nameMap = useNameMap();

  const refFor = (row) => doc(db, row._col, row._id || row.id);

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
      },
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const entryRows = useMemo(
    () => (Array.isArray(rawTimeLogs) ? rawTimeLogs.map(normalizeTimeLog) : []),
    [rawTimeLogs],
  );

  const onEntryCellEditCommit = async (params) => {
    const row = params.row || {};
    if (!(row?._id || row?.id)) return;
    const ref = refFor(row);
    const { field, value } = params;
    const patch = {};

    if (field === "driverEmail") {
      patch.driverEmail = String(value || "");
      patch.driver = String(value || "");
    } else if (field === "vehicle") {
      patch.rideId = String(value || "");
    } else if (field === "trips") {
      patch.trips = Number(value || 0);
    } else if (field === "passengers") {
      patch.passengers = Number(value || 0);
    } else if (field === "note") {
      patch.note = String(value || "");
    }

    if (Object.keys(patch).length) await updateDoc(ref, patch);
  };

  const entryFiltered = useMemo(() => {
    return entryRows.filter((r) => {
      if (entryDriver) {
        const match =
          r.driverEmail.toLowerCase().includes(entryDriver.toLowerCase()) ||
          (nameMap[r.driverEmail.toLowerCase()] || "")
            .toLowerCase()
            .includes(entryDriver.toLowerCase());
        if (!match) return false;
      }
      const startDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      const endDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;
      if (entryStartAfter && (!startDj || !startDj.isAfter(entryStartAfter)))
        return false;
      if (entryEndBefore) {
        const compareDj = endDj || startDj;
        if (!compareDj || !compareDj.isBefore(entryEndBefore)) return false;
      }
      if (entrySearch) {
        const q = entrySearch.toLowerCase();
        const text =
          `${r.driverEmail} ${
            nameMap[r.driverEmail.toLowerCase()] || ""
          } ${r.vehicle} ${r.note}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [
    entryRows,
    entryDriver,
    entryStartAfter,
    entryEndBefore,
    entrySearch,
    nameMap,
  ]);

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
      },
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const shootoutRows = useMemo(
    () =>
      Array.isArray(rawShootout) ? rawShootout.map(normalizeShootout) : [],
    [rawShootout],
  );

  const onShootCellEditCommit = async (params) => {
    const row = params.row || {};
    if (!(row?._id || row?.id)) return;
    const ref = refFor(row);
    const { field, value } = params;
    const patch = {};

    if (field === "driverEmail") patch.driverEmail = String(value || "");
    else if (field === "vehicle") patch.vehicle = String(value || "");
    else if (field === "trips") patch.trips = Number(value || 0);
    else if (field === "passengers") patch.passengers = Number(value || 0);
    else if (field === "status") patch.status = String(value || "");

    if (Object.keys(patch).length) await updateDoc(ref, patch);
  };

  useEffect(() => {
    if (entryRows.length) {
      console.log("[entries] sample", entryRows.slice(0, 3));
    }
    if (shootoutRows.length) {
      console.log("[shootout] sample", shootoutRows.slice(0, 3));
    }
  }, [entryRows, shootoutRows]);

  const shootFiltered = useMemo(() => {
    return shootoutRows.filter((r) => {
      if (shootDriver) {
        const match =
          r.driverEmail.toLowerCase().includes(shootDriver.toLowerCase()) ||
          (nameMap[r.driverEmail.toLowerCase()] || "")
            .toLowerCase()
            .includes(shootDriver.toLowerCase());
        if (!match) return false;
      }
      const startDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      const endDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;
      if (shootStartAfter && (!startDj || !startDj.isAfter(shootStartAfter)))
        return false;
      if (shootEndBefore) {
        const compareDj = endDj || startDj;
        if (!compareDj || !compareDj.isBefore(shootEndBefore)) return false;
      }
      if (shootSearch) {
        const q = shootSearch.toLowerCase();
        const text =
          `${r.driverEmail} ${
            nameMap[r.driverEmail.toLowerCase()] || ""
          } ${r.vehicle} ${r.status}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [
    shootoutRows,
    shootDriver,
    shootStartAfter,
    shootEndBefore,
    shootSearch,
    nameMap,
  ]);

  /** ---------------- Weekly Summary (unchanged) ---------------- */
  const [tab, setTab] = useState(0);
  const [weekStart, setWeekStart] = useState(dayjs().startOf("week"));
  const weekEnd = useMemo(() => weekStart.add(1, "week"), [weekStart]);

  const weekly = useMemo(() => {
    const inWeek = entryRows.filter((r) => {
      const s = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      if (!s) return false;
      return (
        (s.isAfter(weekStart) || s.isSame(weekStart)) && s.isBefore(weekEnd)
      );
    });
    const byDriver = new Map();
    for (const r of inWeek) {
      const key = r.driverEmail || "Unknown";
      const prev = byDriver.get(key) || {
        driver: nameMap[key.toLowerCase()] || key,
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
  }, [entryRows, weekStart, weekEnd, nameMap]);

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
    if (!(editRow?._id || editRow?.id)) return;
    const ref = refFor(editRow);
    const patch = {};
    if (Number.isFinite(editRow.startTime))
      patch.startTime = Timestamp.fromMillis(editRow.startTime);
    if (Number.isFinite(editRow.endTime))
      patch.endTime = Timestamp.fromMillis(editRow.endTime);
    if (
      editRow._col === "timeLogs" &&
      Number.isFinite(editRow.startTime) &&
      Number.isFinite(editRow.endTime)
    ) {
      patch.duration = Math.max(0, editRow.endTime - editRow.startTime);
    }
    await updateDoc(ref, patch);
    setEditOpen(false);
  };

  /** ---------------- Delete ---------------- */
  const handleDelete = async (row) => {
    if (!(row?._id || row?.id)) return;
    if (!window.confirm("Delete this record?")) return;
    await deleteDoc(refFor(row));
  };

  const entryColumns = useMemo(
    () => [
      {
        field: "driverEmail",
        headerName: "Driver",
        flex: 1,
        minWidth: 180,
        editable: true,
        renderCell: (p) => {
          const email = p.row?.driverEmail || "";
          const name = nameMap[email.toLowerCase()];
          if (!name) return email;
          return (
            <Tooltip title={email}>
              <span>{name}</span>
            </Tooltip>
          );
        },
      },
      { field: "_id", headerName: "_id", width: 140, valueGetter: (p) => p.row?._id || "" },
      { field: "id", headerName: "id", width: 140, valueGetter: (p) => p.row?.id || "" },
      {
        field: "vehicle",
        headerName: "Vehicle / Ride",
        flex: 1,
        minWidth: 160,
        editable: true,
      },
      startCol("startTime"),
      endCol("endTime"),
      durationCol("duration"),
      {
        field: "trips",
        headerName: "Trips",
        type: "number",
        width: 90,
        editable: true,
      },
      {
        field: "passengers",
        headerName: "Pax",
        type: "number",
        width: 90,
        editable: true,
      },
      {
        field: "note",
        headerName: "Note",
        flex: 1,
        minWidth: 160,
        editable: true,
      },
      actionsCol(openEditModal, handleDelete),
    ],
    [nameMap],
  );

  const shootoutColumns = useMemo(
    () => [
      {
        field: "driverEmail",
        headerName: "Driver",
        flex: 1,
        minWidth: 180,
        editable: true,
        renderCell: (p) => {
          const email = p.row?.driverEmail || "";
          const name = nameMap[email.toLowerCase()];
          if (!name) return email;
          return (
            <Tooltip title={email}>
              <span>{name}</span>
            </Tooltip>
          );
        },
      },
      { field: "_id", headerName: "_id", width: 140, valueGetter: (p) => p.row?._id || "" },
      { field: "id", headerName: "id", width: 140, valueGetter: (p) => p.row?.id || "" },
      {
        field: "vehicle",
        headerName: "Vehicle",
        flex: 1,
        minWidth: 140,
        editable: true,
      },
      startCol("startTime"),
      endCol("endTime"),
      durationCol("duration"),
      {
        field: "trips",
        headerName: "Trips",
        type: "number",
        width: 90,
        editable: true,
      },
      {
        field: "passengers",
        headerName: "Pax",
        type: "number",
        width: 90,
        editable: true,
      },
      { field: "status", headerName: "Status", width: 120, editable: true },
      {
        field: "createdAt",
        headerName: "Created",
        minWidth: 170,
        valueGetter: (p) => p?.row?.createdAt,
        valueFormatter: (p) => fmtDateTimeMs(p?.value),
      },
      actionsCol(openEditModal, handleDelete),
    ],
    [nameMap],
  );

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
            editMode="cell"
            onCellEditCommit={onEntryCellEditCommit}
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
                {
                  field: "sessions",
                  headerName: "Sessions",
                  width: 120,
                  type: "number",
                },
                {
                  field: "hours",
                  headerName: "Hours",
                  width: 110,
                  type: "number",
                },
                {
                  field: "trips",
                  headerName: "Trips",
                  width: 110,
                  type: "number",
                },
                {
                  field: "passengers",
                  headerName: "Pax",
                  width: 110,
                  type: "number",
                },
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
            editMode="cell"
            onCellEditCommit={onShootCellEditCommit}
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

      {/* Edit modal for Start/End */}
      <Dialog open={editOpen} onClose={closeEditModal} fullWidth maxWidth="sm">
        <DialogTitle>Edit times</DialogTitle>
        <DialogContent>
          {editRow && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <DateTimePicker
                label="Start time"
                value={
                  Number.isFinite(editRow.startTime)
                    ? dayjs(editRow.startTime)
                    : null
                }
                onChange={(v) =>
                  setEditRow((r) => ({
                    ...r,
                    startTime: v ? v.valueOf() : null,
                  }))
                }
                slotProps={{ textField: { size: "small" } }}
              />
              <DateTimePicker
                label="End time"
                value={
                  Number.isFinite(editRow.endTime)
                    ? dayjs(editRow.endTime)
                    : null
                }
                onChange={(v) =>
                  setEditRow((r) => ({
                    ...r,
                    endTime: v ? v.valueOf() : null,
                  }))
                }
                slotProps={{ textField: { size: "small" } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditModal}>Cancel</Button>
          <Button onClick={saveEditModal} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
