/* Proprietary and confidential. See LICENSE. */
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  useMediaQuery,
} from "@mui/material";
import { DatePicker, DateTimePicker } from "@mui/x-date-pickers";
import { DataGrid, GridToolbar, useGridApiRef } from "@mui/x-data-grid";
import { gridFilteredSortedRowEntriesSelector } from "@mui/x-data-grid/hooks/features/filter";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import Papa from "papaparse";

import PageContainer from "./PageContainer.jsx";
import {
  subscribeTimeLogs,
  subscribeShootoutStats,
  subscribeDisplayNameMap,
  patchTimeLog,
  patchShootoutStat,
} from "../hooks/api";

import { doc, deleteDoc } from "firebase/firestore";
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

function exportCsv(rows, filename) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ---------------- normalizers (strict to each collection) ---------------- */
// timeLogs fields: driver (string), duration (minutes), endTime (ts), loggedAt (ts), rideId (string), startTime (ts)
function normalizeTimeLog(r) {
  const startMs = toMs(r.startTime);
  const endMs = toMs(r.endTime);
  const d = Number(r.duration);
  const durMin = Number.isFinite(d)
    ? d
    : Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
    ? Math.round((endMs - startMs) / 60000)
    : null;
  const realId = r.id || r._id || r.docId || null;
  const driverVal = r.driver || r.driverEmail || r.userEmail || "";
  return {
    _col: "timeLogs",
    _id: realId,
    id:
      realId ??
      `${(driverVal || "row").toLowerCase()}-${
        startMs ?? toMs(r.loggedAt) ?? 0
      }-${endMs ?? 0}`,
    driver: driverVal,
    rideId: r.rideId || "",
    startTime: startMs,
    endTime: endMs,
    durationMin: durMin, // UI uses minutes; API helper converts when patching
    loggedAt: toMs(r.loggedAt),
  };
}

// shootoutStats fields: driverEmail, vehicle, startTime, endTime, trips, passengers, createdAt
function normalizeShootout(r) {
  const realId = r.id || r._id || r.docId || null;
  return {
    _col: "shootoutStats",
    _id: realId,
    id:
      realId ??
      `${(r.driverEmail || "row").toLowerCase()}-${
        toMs(r.startTime) ?? 0
      }`,
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
      onChange={(nv) =>
        api.setEditCellValue({ id, field, value: nv ? nv.valueOf() : null })
      }
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
      onChange={(e) =>
        api.setEditCellValue({ id, field, value: e.target.value })
      }
      inputProps={{ step: 1 }}
      fullWidth
    />
  );
}

/* ---------------- component ---------------- */
export default function AdminTimeLog() {
  /* ----- Display name map from API hook (users + userAccess) ----- */
  const [nameMap, setNameMap] = useState({});
  useEffect(() => {
    const unsub = subscribeDisplayNameMap(setNameMap);
    return () => unsub && unsub();
  }, []);

  const refFor = (row) => doc(db, row._col, row._id || row.id);

  /* -------- Entries (timeLogs) -------- */
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

  const processEntryUpdate = async (newRow) => {
    await patchTimeLog(newRow._id || newRow.id, {
      driver: newRow.driver,
      rideId: newRow.rideId,
      startTime: newRow.startTime,
      endTime: newRow.endTime,
      durationMin: newRow.durationMin,
      loggedAt: newRow.loggedAt,
    });
    return newRow;
  };

  const entryFiltered = useMemo(() => {
    return entryRows.filter((r) => {
      if (entryDriver) {
        const disp = isEmail(r.driver)
          ? nameMap[r.driver.toLowerCase()] || r.driver
          : r.driver;
        const hay = `${r.driver} ${disp}`.toLowerCase();
        if (!hay.includes(entryDriver.toLowerCase())) return false;
      }
      const sDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
      const eDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;
      if (entryStartAfter && (!sDj || !sDj.isAfter(entryStartAfter)))
        return false;
      if (entryEndBefore) {
        const cmp = eDj || sDj;
        if (!cmp || !cmp.isBefore(entryEndBefore)) return false;
      }
      if (entrySearch) {
        const text = [r.driver, isEmail(r.driver) ? nameMap[r.driver.toLowerCase()] || "" : "", r.rideId]
          .join(" ")
          .toLowerCase();
        if (!text.includes(entrySearch.toLowerCase())) return false;
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

  const entryApiRef = useGridApiRef();
  const [entryTotals, setEntryTotals] = useState({ sessions: 0, hours: 0 });
  const updateEntryTotals = useCallback(() => {
    if (!entryApiRef.current) return;
    const rows = gridFilteredSortedRowEntriesSelector(entryApiRef).map(
      (r) => r.model,
    );
    let totalMin = 0;
    rows.forEach((r) => {
      let min = Number(r.durationMin);
      if (
        !Number.isFinite(min) &&
        Number.isFinite(r.startTime) &&
        Number.isFinite(r.endTime) &&
        r.endTime >= r.startTime
      ) {
        min = Math.round((r.endTime - r.startTime) / 60000);
      }
      totalMin += Number.isFinite(min) ? min : 0;
    });
    setEntryTotals({
      sessions: rows.length,
      hours: Number((totalMin / 60).toFixed(2)),
    });
  }, [entryApiRef]);
  useEffect(() => {
    updateEntryTotals();
  }, [entryFiltered, updateEntryTotals]);

  /* -------- Shootout (shootoutStats) -------- */
  const [rawShootout, setRawShootout] = useState([]);
  const [loadingShootout, setLoadingShootout] = useState(true);
  const [shootError, setShootError] = useState("");

  const [shootSearch, setShootSearch] = useState("");
  const [shootDriver, setShootDriver] = useState("");
  const [shootStartAfter, setShootStartAfter] = useState(null);
  const [shootEndBefore, setShootEndBefore] = useState(null);
  const [shootSumSearch, setShootSumSearch] = useState("");

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
    () => (Array.isArray(rawShootout) ? rawShootout.map(normalizeShootout) : []),
    [rawShootout],
  );

  const processShootoutUpdate = async (newRow) => {
    await patchShootoutStat(newRow._id || newRow.id, {
      driverEmail: newRow.driverEmail,
      vehicle: newRow.vehicle,
      trips: newRow.trips,
      passengers: newRow.passengers,
      startTime: newRow.startTime,
      endTime: newRow.endTime,
      createdAt: newRow.createdAt,
    });
    return newRow;
  };

  const shootoutFiltered = useMemo(
    () =>
      shootoutRows.filter((r) => {
        if (shootDriver) {
          const disp = nameMap[r.driverEmail.toLowerCase()] || r.driverEmail;
          const hay = `${r.driverEmail} ${disp}`.toLowerCase();
          if (!hay.includes(shootDriver.toLowerCase())) return false;
        }
        const sDj = Number.isFinite(r.startTime) ? dayjs(r.startTime) : null;
        const eDj = Number.isFinite(r.endTime) ? dayjs(r.endTime) : null;
        if (shootStartAfter && (!sDj || !sDj.isAfter(shootStartAfter)))
          return false;
        if (shootEndBefore) {
          const cmp = eDj || sDj;
          if (!cmp || !cmp.isBefore(shootEndBefore)) return false;
        }
        if (shootSearch) {
          const text = `${r.driverEmail} ${
            nameMap[r.driverEmail.toLowerCase()] || ""
          } ${r.vehicle}`.toLowerCase();
          if (!text.includes(shootSearch.toLowerCase())) return false;
        }
        return true;
      }),
    [
      shootoutRows,
      shootDriver,
      shootStartAfter,
      shootEndBefore,
      shootSearch,
      nameMap,
    ],
  );

  const shootApiRef = useGridApiRef();
  const [shootTotals, setShootTotals] = useState({
    sessions: 0,
    trips: 0,
    passengers: 0,
    hours: 0,
  });
  const updateShootTotals = useCallback(() => {
    const rows = gridFilteredSortedRowEntriesSelector(shootApiRef).map(
      (r) => r.model,
    );
    let trips = 0;
    let passengers = 0;
    let min = 0;
    rows.forEach((r) => {
      trips += Number(r.trips) || 0;
      passengers += Number(r.passengers) || 0;
      if (
        Number.isFinite(r.startTime) &&
        Number.isFinite(r.endTime) &&
        r.endTime >= r.startTime
      ) {
        min += Math.round((r.endTime - r.startTime) / 60000);
      }
    });
    setShootTotals({
      sessions: rows.length,
      trips,
      passengers,
      hours: Number((min / 60).toFixed(2)),
    });
  }, [shootApiRef]);
  useEffect(() => {
    updateShootTotals();
  }, [shootoutFiltered, updateShootTotals]);

  const shootSummaryRows = useMemo(() => {
    const by = new Map();
    shootoutRows.forEach((r) => {
      const email = (r.driverEmail || "").toLowerCase();
      if (!email) return;
      const cur =
        by.get(email) || {
          id: email,
          driverEmail: r.driverEmail || "",
          sessions: 0,
          trips: 0,
          passengers: 0,
          durationMs: 0,
        };
      cur.sessions += 1;
      cur.trips += Number(r.trips) || 0;
      cur.passengers += Number(r.passengers) || 0;
      if (
        Number.isFinite(r.startTime) &&
        Number.isFinite(r.endTime) &&
        r.endTime >= r.startTime
      ) {
        cur.durationMs += r.endTime - r.startTime;
      }
      by.set(email, cur);
    });
    return Array.from(by.values()).map((v) => ({
      ...v,
      driver: nameMap[v.driverEmail.toLowerCase()] || v.driverEmail,
      hours: Number((v.durationMs / 3600000).toFixed(2)),
    }));
  }, [shootoutRows, nameMap]);

  const shootSummaryFiltered = useMemo(() => {
    if (!shootSumSearch) return shootSummaryRows;
    const s = shootSumSearch.toLowerCase();
    return shootSummaryRows.filter((r) =>
      `${r.driverEmail} ${r.driver}`.toLowerCase().includes(s),
    );
  }, [shootSummaryRows, shootSumSearch]);

  const shootSummaryApiRef = useGridApiRef();
  const [shootSummaryTotals, setShootSummaryTotals] = useState({
    sessions: 0,
    trips: 0,
    passengers: 0,
    hours: 0,
  });
  const updateShootSummaryTotals = useCallback(() => {
    const rows = gridFilteredSortedRowEntriesSelector(
      shootSummaryApiRef,
    ).map((r) => r.model);
    let sessions = 0;
    let trips = 0;
    let passengers = 0;
    let hours = 0;
    rows.forEach((r) => {
      sessions += Number(r.sessions) || 0;
      trips += Number(r.trips) || 0;
      passengers += Number(r.passengers) || 0;
      hours += Number(r.hours) || 0;
    });
    setShootSummaryTotals({
      sessions,
      trips,
      passengers,
      hours: Number(hours.toFixed(2)),
    });
  }, [shootSummaryApiRef]);
  useEffect(() => {
    updateShootSummaryTotals();
  }, [shootSummaryFiltered, updateShootSummaryTotals]);

  const shootSummaryColumns = useMemo(
    () => [
      { field: "driver", headerName: "Driver", flex: 1, minWidth: 180 },
      { field: "sessions", headerName: "Sessions", width: 110, type: "number" },
      { field: "trips", headerName: "Trips", width: 110, type: "number" },
      {
        field: "passengers",
        headerName: "Passengers",
        width: 140,
        type: "number",
      },
      {
        field: "durationMin",
        headerName: "Duration",
        width: 130,
        valueGetter: (_, row) =>
          Math.round((row?.durationMs || 0) / 60000),
        valueFormatter: (value) => fmtMinutes(value),
      },
      { field: "hours", headerName: "Hours", width: 110, type: "number" },
    ],
    [],
  );

  /* -------- Modal (edit ALL fields for the selected row) -------- */
  const [tab, setTab] = useState(0);
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));
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

  const setEdit = (k, v) => setEditRow((r) => ({ ...r, [k]: v }));

  const saveEditModal = async () => {
    if (!(editRow?._id || editRow?.id)) return;
    if (editRow._col === "timeLogs") {
      await patchTimeLog(editRow._id || editRow.id, {
        driver: editRow.driver,
        rideId: editRow.rideId,
        startTime: Number.isFinite(editRow.startTime) ? editRow.startTime : null,
        endTime: Number.isFinite(editRow.endTime) ? editRow.endTime : null,
        loggedAt: Number.isFinite(editRow.loggedAt) ? editRow.loggedAt : null,
        durationMin: Number.isFinite(editRow.durationMin)
          ? editRow.durationMin
          : undefined,
      });
    } else if (editRow._col === "shootoutStats") {
      await patchShootoutStat(editRow._id || editRow.id, {
        driverEmail: editRow.driverEmail,
        vehicle: editRow.vehicle,
        trips: editRow.trips,
        passengers: editRow.passengers,
        startTime: Number.isFinite(editRow.startTime) ? editRow.startTime : null,
        endTime: Number.isFinite(editRow.endTime) ? editRow.endTime : null,
        createdAt: Number.isFinite(editRow.createdAt)
          ? editRow.createdAt
          : null,
      });
    }
    setEditOpen(false);
  };

  const handleDelete = async (row) => {
    if (!(row?._id || row?.id)) return;
    if (!window.confirm("Delete this record?")) return;
    await deleteDoc(refFor(row));
  };

  /* -------- Columns (only the real fields per collection) -------- */
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
          return name ? (
            <Tooltip title={d}>
              <span>{name}</span>
            </Tooltip>
          ) : (
            d
          );
        },
      },
      {
        field: "rideId",
        headerName: "Ride ID",
        flex: 0.9,
        minWidth: 140,
        editable: true,
      },
      {
        field: "startTime",
        headerName: "Start",
        flex: 1,
        minWidth: 160,
        editable: true,
        valueGetter: (value) => value,
        valueFormatter: (value) => fmtDateTimeMs(value),
        renderCell: (params) => fmtDateTimeMs(params.row?.startTime),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) =>
          (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "endTime",
        headerName: "End",
        flex: 1,
        minWidth: 160,
        editable: true,
        valueGetter: (value) => value,
        valueFormatter: (value) => fmtDateTimeMs(value),
        renderCell: (params) => fmtDateTimeMs(params.row?.endTime),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) =>
          (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "durationMin",
        headerName: "Duration",
        width: 120,
        editable: true,
        valueGetter: (value, row) => {
          if (Number.isFinite(value)) return value;
          const s = row?.startTime;
          const e = row?.endTime;
          return Number.isFinite(s) && Number.isFinite(e) && e >= s
            ? Math.round((e - s) / 60000)
            : null;
        },
        valueFormatter: (value) => fmtMinutes(value),
        renderEditCell: (params) => <NumberEditCell {...params} />,
        sortComparator: (a, b) =>
          (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "loggedAt",
        headerName: "Logged At",
        flex: 0.9,
        minWidth: 160,
        editable: true,
        valueGetter: (value) => value,
        valueFormatter: (value) => fmtDateTimeMs(value),
        renderCell: (params) => fmtDateTimeMs(params.row?.loggedAt),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) =>
          (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
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
      },
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
          const name = email ? nameMap[email.toLowerCase()] : "";
          return name ? (
            <Tooltip title={email}>
              <span>{name}</span>
            </Tooltip>
          ) : (
            email
          );
        },
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        flex: 1,
        minWidth: 140,
        editable: true,
      },
      {
        field: "startTime",
        headerName: "Start",
        flex: 1,
        minWidth: 160,
        editable: true,
        valueGetter: (value) => value,
        valueFormatter: (value) => fmtDateTimeMs(value),
        renderCell: (params) => fmtDateTimeMs(params.row?.startTime),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) =>
          (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "endTime",
        headerName: "End",
        flex: 1,
        minWidth: 160,
        editable: true,
        valueGetter: (value) => value,
        valueFormatter: (value) => fmtDateTimeMs(value),
        renderCell: (params) => fmtDateTimeMs(params.row?.endTime),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) =>
          (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
      },
      {
        field: "durationMin",
        headerName: "Duration",
        width: 130,
        valueGetter: (value, row) => {
          const s = row?.startTime;
          const e = row?.endTime;
          return Number.isFinite(s) && Number.isFinite(e) && e >= s
            ? Math.round((e - s) / 60000)
            : null;
        },
        valueFormatter: (value) => fmtMinutes(value),
      },
      {
        field: "trips",
        headerName: "Trips",
        type: "number",
        width: 110,
        editable: true,
        renderEditCell: (p) => <NumberEditCell {...p} />,
      },
      {
        field: "passengers",
        headerName: "Pax",
        type: "number",
        width: 110,
        editable: true,
        renderEditCell: (p) => <NumberEditCell {...p} />,
      },
      {
        field: "createdAt",
        headerName: "Created",
        flex: 0.9,
        minWidth: 170,
        editable: true,
        valueGetter: (value) => value,
        valueFormatter: (value) => fmtDateTimeMs(value),
        renderCell: (params) => fmtDateTimeMs(params.row?.createdAt),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: (a, b) =>
          (Number.isFinite(a) ? a : -1) - (Number.isFinite(b) ? b : -1),
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
      },
    ],
    [nameMap],
  );

  /* -------- Weekly Summary (timeLogs only) -------- */
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
      const key = isEmail(r.driver)
        ? r.driver.toLowerCase()
        : r.driver || "Unknown";
      const prev =
        by.get(key) || {
          driver: isEmail(key) ? nameMap[key] || key : key,
          sessions: 0,
          min: 0,
        };
      prev.sessions += 1;
      prev.min += Number.isFinite(r.durationMin) ? r.durationMin : 0;
      by.set(key, prev);
    }
    return Array.from(by.values()).map((v, i) => ({
      id: i,
      driver: v.driver,
      sessions: v.sessions,
      hours: Number((v.min / 60).toFixed(2)),
    }));
  }, [entryRows, weekStart, weekEnd, nameMap]);

  const weeklyApiRef = useGridApiRef();
  const [weeklyTotals, setWeeklyTotals] = useState({ sessions: 0, hours: 0 });
  const updateWeeklyTotals = useCallback(() => {
    const rows = gridFilteredSortedRowEntriesSelector(weeklyApiRef).map(
      (r) => r.model,
    );
    let sessions = 0;
    let hours = 0;
    rows.forEach((r) => {
      sessions += Number(r.sessions) || 0;
      hours += Number(r.hours) || 0;
    });
    setWeeklyTotals({
      sessions,
      hours: Number(hours.toFixed(2)),
    });
  }, [weeklyApiRef]);
  useEffect(() => {
    updateWeeklyTotals();
  }, [weekly, updateWeeklyTotals]);

  return (
    <PageContainer pt={2} pb={4}>
      <Box sx={{ mb: 2 }}>
        {isSmall ? (
          <FormControl size="small" fullWidth>
            <InputLabel id="admin-time-log-tab">View</InputLabel>
            <Select
              labelId="admin-time-log-tab"
              label="View"
              value={tab}
              onChange={(e) => setTab(Number(e.target.value))}
            >
              <MenuItem value={0}>Entries</MenuItem>
              <MenuItem value={1}>Weekly Summary</MenuItem>
              <MenuItem value={2}>Shootout Stats</MenuItem>
              <MenuItem value={3}>Shootout Summary</MenuItem>
            </Select>
          </FormControl>
        ) : (
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
            <Tab label="Shootout Summary" />
          </Tabs>
        )}
      </Box>

      {/* Entries */}
      {tab === 0 && (
        <Box>
          {entryError && <Alert severity="error">{entryError}</Alert>}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                exportCsv(
                  entryFiltered.map(({ _col, _id, ...rest }) => ({
                    ...rest,
                    startTime: fmtDateTimeMs(rest.startTime),
                    endTime: fmtDateTimeMs(rest.endTime),
                    loggedAt: fmtDateTimeMs(rest.loggedAt),
                  })),
                  "timeLogs.csv",
                )
              }
            >
              Export CSV
            </Button>
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
          <Box sx={{ width: 1, overflowX: "auto" }}>
            <DataGrid
              apiRef={entryApiRef}
              onStateChange={updateEntryTotals}
              autoHeight
              density="compact"
              rows={entryFiltered || []}
              columns={entryColumns}
              getRowId={(r) => r._id || r.id}
              loading={!!loadingEntries}
              disableRowSelectionOnClick
              editMode="row"
              processRowUpdate={processEntryUpdate}
              onProcessRowUpdateError={() =>
                alert("Failed to update time log")
              }
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
          <Typography variant="body2" align="right" sx={{ mt: 0.5 }}>
            Sessions: {entryTotals.sessions} | Hours: {entryTotals.hours}
          </Typography>
        </Box>
      )}

      {/* Shootout Summary */}
      {tab === 3 && (
        <Box>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                exportCsv(
                  shootSummaryFiltered.map(
                    ({ durationMs, driverEmail, ...rest }) => ({
                      ...rest,
                      duration: fmtMinutes(Math.round((durationMs || 0) / 60000)),
                    }),
                  ),
                  "shootoutSummary.csv",
                )
              }
            >
              Export CSV
            </Button>
            <TextField
              label="Search"
              value={shootSumSearch}
              onChange={(e) => setShootSumSearch(e.target.value)}
              size="small"
            />
          </Box>
          <Box sx={{ width: 1, overflowX: "auto" }}>
            <DataGrid
              apiRef={shootSummaryApiRef}
              onStateChange={updateShootSummaryTotals}
              autoHeight
              density="compact"
              rows={shootSummaryFiltered}
              columns={shootSummaryColumns}
              getRowId={(r) => r.id}
              disableRowSelectionOnClick
              initialState={{
                sorting: { sortModel: [{ field: "trips", sort: "desc" }] },
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              slots={{ toolbar: GridToolbar }}
            />
          </Box>
          <Typography variant="body2" align="right" sx={{ mt: 0.5 }}>
            Sessions: {shootSummaryTotals.sessions} | Trips:
            {" "}
            {shootSummaryTotals.trips} | Pax: {shootSummaryTotals.passengers} |
            Hours: {shootSummaryTotals.hours}
          </Typography>
        </Box>
      )}

      {/* Weekly */}
      {tab === 1 && (
        <Box>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                exportCsv(
                  weekly.map(({ driver, sessions, hours }) => ({
                    driver,
                    sessions,
                    hours,
                  })),
                  "weeklySummary.csv",
                )
              }
            >
              Export CSV
            </Button>
            <DatePicker
              label="Week of"
              value={weekStart}
              onChange={(v) => v && setWeekStart(v.startOf("week"))}
              slotProps={{ textField: { size: "small" } }}
            />
          </Box>
          {weekly.length === 0 ? (
            <Typography variant="body2">
              No data for selected week.
            </Typography>
          ) : (
            <Box sx={{ width: 1, overflowX: "auto" }}>
              <DataGrid
                apiRef={weeklyApiRef}
                onStateChange={updateWeeklyTotals}
                autoHeight
                density="compact"
                rows={weekly || []}
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
                ]}
                hideFooterSelectedRowCount
                initialState={{
                  sorting: { sortModel: [{ field: "hours", sort: "desc" }] },
                  pagination: { paginationModel: { pageSize: 10 } },
                }}
              />
            </Box>
          )}
          <Typography variant="body2" align="right" sx={{ mt: 0.5 }}>
            Sessions: {weeklyTotals.sessions} | Hours: {weeklyTotals.hours}
          </Typography>
        </Box>
      )}

      {/* Shootout */}
      {tab === 2 && (
        <Box>
          {shootError && <Alert severity="error">{shootError}</Alert>}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() =>
                exportCsv(
                  shootoutFiltered.map(({ _col, _id, ...rest }) => ({
                    ...rest,
                    startTime: fmtDateTimeMs(rest.startTime),
                    endTime: fmtDateTimeMs(rest.endTime),
                    createdAt: fmtDateTimeMs(rest.createdAt),
                    duration: fmtMinutes(
                      Number.isFinite(rest.startTime) &&
                      Number.isFinite(rest.endTime) &&
                      rest.endTime >= rest.startTime
                        ? Math.round((rest.endTime - rest.startTime) / 60000)
                        : null,
                    ),
                  })),
                  "shootoutStats.csv",
                )
              }
            >
              Export CSV
            </Button>
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
          <Box sx={{ width: 1, overflowX: "auto" }}>
            <DataGrid
              apiRef={shootApiRef}
              onStateChange={updateShootTotals}
              autoHeight
              density="compact"
              rows={shootoutFiltered}
              columns={shootoutColumns}
              getRowId={(r) => r._id || r.id}
              loading={!!loadingShootout}
              disableRowSelectionOnClick
              editMode="row"
              processRowUpdate={processShootoutUpdate}
              onProcessRowUpdateError={() =>
                alert("Failed to update shootout stat")
              }
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
          <Typography variant="body2" align="right" sx={{ mt: 0.5 }}>
            Sessions: {shootTotals.sessions} | Trips: {shootTotals.trips} | Pax:
            {" "}
            {shootTotals.passengers} | Hours: {shootTotals.hours}
          </Typography>
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
                  <TextField
                    label="Driver"
                    value={editRow.driver ?? ""}
                    onChange={(e) => setEdit("driver", e.target.value)}
                    size="small"
                  />
                  <TextField
                    label="Ride ID"
                    value={editRow.rideId ?? ""}
                    onChange={(e) => setEdit("rideId", e.target.value)}
                    size="small"
                  />
                  <DateTimePicker
                    label="Start time"
                    value={
                      Number.isFinite(editRow.startTime)
                        ? dayjs(editRow.startTime)
                        : null
                    }
                    onChange={(v) =>
                      setEdit("startTime", v ? v.valueOf() : null)
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
                      setEdit("endTime", v ? v.valueOf() : null)
                    }
                    slotProps={{ textField: { size: "small" } }}
                  />
                  <TextField
                    label="Duration (minutes)"
                    type="number"
                    value={editRow.durationMin ?? ""}
                    onChange={(e) =>
                      setEdit("durationMin", asInt(e.target.value))
                    }
                    size="small"
                  />
                  <DateTimePicker
                    label="Logged At"
                    value={
                      Number.isFinite(editRow.loggedAt)
                        ? dayjs(editRow.loggedAt)
                        : null
                    }
                    onChange={(v) =>
                      setEdit("loggedAt", v ? v.valueOf() : null)
                    }
                    slotProps={{ textField: { size: "small" } }}
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="Driver Email"
                    value={editRow.driverEmail ?? ""}
                    onChange={(e) => setEdit("driverEmail", e.target.value)}
                    size="small"
                  />
                  <TextField
                    label="Vehicle"
                    value={editRow.vehicle ?? ""}
                    onChange={(e) => setEdit("vehicle", e.target.value)}
                    size="small"
                  />
                  <DateTimePicker
                    label="Start time"
                    value={
                      Number.isFinite(editRow.startTime)
                        ? dayjs(editRow.startTime)
                        : null
                    }
                    onChange={(v) =>
                      setEdit("startTime", v ? v.valueOf() : null)
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
                      setEdit("endTime", v ? v.valueOf() : null)
                    }
                    slotProps={{ textField: { size: "small" } }}
                  />
                  <TextField
                    label="Trips"
                    type="number"
                    value={editRow.trips ?? ""}
                    onChange={(e) => setEdit("trips", asInt(e.target.value))}
                    size="small"
                  />
                  <TextField
                    label="Passengers"
                    type="number"
                    value={editRow.passengers ?? ""}
                    onChange={(e) =>
                      setEdit("passengers", asInt(e.target.value))
                    }
                    size="small"
                  />
                  <DateTimePicker
                    label="Created At"
                    value={
                      Number.isFinite(editRow.createdAt)
                        ? dayjs(editRow.createdAt)
                        : null
                    }
                    onChange={(v) =>
                      setEdit("createdAt", v ? v.valueOf() : null)
                    }
                    slotProps={{ textField: { size: "small" } }}
                  />
                </>
              )}
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
