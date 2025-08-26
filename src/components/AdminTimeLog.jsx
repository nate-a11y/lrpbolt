/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DatePicker, DateTimePicker } from "@mui/x-date-pickers-pro";
import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import Papa from "papaparse";
import { doc, deleteDoc } from "firebase/firestore";

import { safeRow } from "../utils/gridUtils";
import {
  fmtDateTimeCell,
  fmtPlain,
  toJSDate,
  dateSort,
  warnMissingFields,
} from "../utils/gridFormatters";
import { fmtDuration, toDayjs } from "../utils/timeUtils";
import {
  subscribeTimeLogs,
  subscribeShootoutStats,
  subscribeDisplayNameMap,
  patchTimeLog,
  patchShootoutStat,
} from "../hooks/api";
import { db } from "../utils/firebaseInit";

import PageContainer from "./PageContainer.jsx";
import useGridProDefaults from "./grid/useGridProDefaults.js";

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
    if (typeof input === "number" && Number.isFinite(input))
      return input < 1e12 ? input * 1000 : input;
    if (typeof input === "string") {
      const n = Number(input);
      if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
      const t = Date.parse(input);
      return Number.isFinite(t) ? t : null;
    }
  } catch (err) {
    console.error(err);
  }
  return null;
}
function fmtDateTimeMs(ms) {
  const d = toJSDate(ms);
  return d ? dayjs(d).tz(TZ).format("MMM D, h:mm A") : "";
}
function fmtMinutes(min) {
  if (!Number.isFinite(min) || min < 0) return "";
  const h = Math.floor(min / 60);
  const m = Math.floor(min - h * 60);
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
    ? Math.floor((endMs - startMs) / 60000)
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
  const { id, field, value, apiRef } = props;
  const v = Number.isFinite(value) ? dayjs(value) : null;
  return (
    <DateTimePicker
      value={v}
      onChange={(nv) =>
        apiRef.current.setEditCellValue({
          id,
          field,
          value: nv ? nv.valueOf() : null,
        })
      }
      ampm
      slotProps={{ textField: { size: "small" } }}
    />
  );
}
function NumberEditCell(props) {
  const { id, field, value, apiRef } = props;
  return (
    <TextField
      size="small"
      type="number"
      value={value ?? ""}
      onChange={(e) =>
        apiRef.current.setEditCellValue({ id, field, value: e.target.value })
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
    const s = toDayjs(newRow.startTime);
    const e = toDayjs(newRow.endTime);
    const durationMin = s && e ? e.diff(s, "minute") : null;
    await patchTimeLog(newRow._id || newRow.id, {
      driver: newRow.driver,
      rideId: newRow.rideId,
      startTime: newRow.startTime,
      endTime: newRow.endTime,
      durationMin,
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
        cur.durationMs +=
          Math.floor((r.endTime - r.startTime) / 60000) * 60000;
      }
      by.set(email, cur);
    });
    return Array.from(by.values()).map((v) => ({
      ...v,
      driver: nameMap[v.driverEmail.toLowerCase()] || v.driverEmail,
      hours: Math.floor((v.durationMs / 3600000) * 100) / 100,
    }));
  }, [shootoutRows, nameMap]);

  const shootSummaryFiltered = useMemo(() => {
    if (!shootSumSearch) return shootSummaryRows;
    const s = shootSumSearch.toLowerCase();
    return shootSummaryRows.filter((r) =>
      `${r.driverEmail} ${r.driver}`.toLowerCase().includes(s),
    );
  }, [shootSummaryRows, shootSumSearch]);


  const shootSummaryColumns = useMemo(
    () => [
      { field: "driver", headerName: "Driver", flex: 1, minWidth: 180, valueFormatter: fmtPlain("—") },
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
        valueGetter: (p) => {
          const r = safeRow(p)
          return Math.floor((r?.durationMs || 0) / 60000)
        },
        valueFormatter: (p) => fmtMinutes(p?.value),
      },
      { field: "hours", headerName: "Hours", width: 110, type: "number" },
    ],
    [],
  );

  const entryGrid = useGridProDefaults({ gridId: "timeLogEntries", pageSize: 10 });
  const shootSummaryGrid = useGridProDefaults({ gridId: "shootSummary", pageSize: 10 });
  const weeklyGrid = useGridProDefaults({ gridId: "weeklySummary", pageSize: 10 });
  const shootGrid = useGridProDefaults({ gridId: "shootoutStats", pageSize: 10 });

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
      const s = toDayjs(editRow.startTime);
      const e = toDayjs(editRow.endTime);
      await patchTimeLog(editRow._id || editRow.id, {
        driver: editRow.driver,
        rideId: editRow.rideId,
        startTime: Number.isFinite(editRow.startTime) ? editRow.startTime : null,
        endTime: Number.isFinite(editRow.endTime) ? editRow.endTime : null,
        loggedAt: Number.isFinite(editRow.loggedAt) ? editRow.loggedAt : null,
        durationMin: s && e ? e.diff(s, "minute") : null,
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

  const handleDelete = useCallback(async (row) => {
    if (!(row?._id || row?.id)) return;
    if (!window.confirm("Delete this record?")) return;
    await deleteDoc(refFor(row));
  }, []);

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
          const r = safeRow(p)
          const d = r?.driver || "";
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
        valueFormatter: fmtPlain("—"),
      },
      {
        field: "startTime",
        headerName: "Start",
        type: "dateTime",
        minWidth: 180,
        flex: 1,
        editable: true,
        valueGetter: (p) => toJSDate(p?.row?.start ?? p?.row?.startTime),
        valueFormatter: fmtDateTimeCell(TZ, "—"),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: dateSort,
      },
      {
        field: "endTime",
        headerName: "End",
        type: "dateTime",
        minWidth: 180,
        flex: 1,
        editable: true,
        valueGetter: (p) => toJSDate(p?.row?.end ?? p?.row?.endTime),
        valueFormatter: fmtDateTimeCell(TZ, "—"),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: dateSort,
      },
      {
        field: "duration",
        headerName: "Duration",
        width: 120,
        valueGetter: (p) => {
          const r = safeRow(p)
          return r ? { s: toJSDate(r.start ?? r.startTime), e: toJSDate(r.end ?? r.endTime) } : null
        },
        valueFormatter: (params) => (params?.value ? fmtDuration(params.value.s, params.value.e) : '—'),
        sortable: true,
      },
      {
        field: "loggedAt",
        headerName: "Logged At",
        type: "dateTime",
        minWidth: 180,
        flex: 0.9,
        editable: true,
        valueGetter: (p) => toJSDate(p?.row?.loggedAt),
        valueFormatter: fmtDateTimeCell(TZ, "—"),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: dateSort,
      },
      {
        field: "actions",
        type: "actions",
        headerName: "",
        width: 96,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const row = safeRow(p)
          const dis = !(row?._id || row?.id);
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton
                size="small"
                disabled={dis}
                onClick={() => row && openEditModal(row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                disabled={dis}
                onClick={() => row && handleDelete(row)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          );
        },
      },
    ],
    [nameMap, handleDelete],
  );

    const shootoutColumns = useMemo(
      () => [
      {
        field: "driverEmail",
        headerName: "Driver",
        flex: 1,
        minWidth: 180,
        editable: true,
        valueFormatter: fmtPlain("—"),
        renderCell: (p) => {
          const r = safeRow(p)
          const email = r?.driverEmail || "";
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
        valueFormatter: fmtPlain("—"),
      },
      {
        field: "startTime",
        headerName: "Start",
        type: "dateTime",
        flex: 1,
        minWidth: 180,
        editable: true,
        valueGetter: (p) => toJSDate(p?.row?.start ?? p?.row?.startTime),
        valueFormatter: fmtDateTimeCell(TZ, "—"),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: dateSort,
      },
      {
        field: "endTime",
        headerName: "End",
        type: "dateTime",
        flex: 1,
        minWidth: 180,
        editable: true,
        valueGetter: (p) => toJSDate(p?.row?.end ?? p?.row?.endTime),
        valueFormatter: fmtDateTimeCell(TZ, "—"),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: dateSort,
      },
      {
        field: "duration",
        headerName: "Duration",
        width: 130,
        valueGetter: (p) => {
          const r = safeRow(p)
          return r ? { s: toJSDate(r.start ?? r.startTime), e: toJSDate(r.end ?? r.endTime) } : null
        },
        valueFormatter: (params) => (params?.value ? fmtDuration(params.value.s, params.value.e) : '—'),
        sortable: true,
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
        type: "dateTime",
        flex: 0.9,
        minWidth: 180,
        editable: true,
        valueGetter: (p) => toJSDate(p?.row?.createdAt),
        valueFormatter: fmtDateTimeCell(TZ, "—"),
        renderEditCell: (params) => <DateTimeEditCell {...params} />,
        sortComparator: dateSort,
      },
      {
        field: "actions",
        type: "actions",
        headerName: "",
        width: 96,
        sortable: false,
        filterable: false,
        renderCell: (p) => {
          const row = safeRow(p)
          const dis = !(row?._id || row?.id);
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton
                size="small"
                disabled={dis}
                onClick={() => row && openEditModal(row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                disabled={dis}
                onClick={() => row && handleDelete(row)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          );
        },
      },
      ],
      [nameMap, handleDelete],
    );

    useEffect(() => {
      warnMissingFields(entryColumns, entryRows);
      warnMissingFields(shootSummaryColumns, shootSummaryRows);
      warnMissingFields(shootoutColumns, shootoutRows);
    }, [entryRows, shootSummaryRows, shootoutRows, entryColumns, shootSummaryColumns, shootoutColumns]);

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
      hours: Math.floor((v.min / 60) * 100) / 100,
    }));
  }, [entryRows, weekStart, weekEnd, nameMap]);


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
                  entryFiltered.map(({ _col, _id, ...rest }) => {
                    void _col;
                    void _id;
                    return {
                      ...rest,
                      startTime: fmtDateTimeMs(rest.startTime),
                      endTime: fmtDateTimeMs(rest.endTime),
                      loggedAt: fmtDateTimeMs(rest.loggedAt),
                    };
                  }),
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
            <DataGridPro
              {...entryGrid}
              rows={entryFiltered ?? []}
              columns={entryColumns}
              loading={!!loadingEntries}
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
                ...entryGrid.initialState,
                sorting: { sortModel: [{ field: "startTime", sort: "desc" }] },
              }}
              getRowId={(r) => r.id ?? r.rideId ?? r._id ?? `${r.pickupTime ?? r.start ?? 'row'}-${r.vehicle ?? ''}`}
            />
          </Box>
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
                    ({ durationMs, ...rest }) => ({
                      ...rest,
                      duration: fmtMinutes(
                        Math.floor((durationMs || 0) / 60000),
                      ),
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
            <DataGridPro
              {...shootSummaryGrid}
              rows={shootSummaryFiltered ?? []}
              columns={shootSummaryColumns}
              slots={{ toolbar: GridToolbar }}
              initialState={{
                ...shootSummaryGrid.initialState,
                sorting: { sortModel: [{ field: "trips", sort: "desc" }] },
              }}
              getRowId={(r) => r.id ?? r.rideId ?? r._id ?? `${r.pickupTime ?? r.start ?? 'row'}-${r.vehicle ?? ''}`}
            />
          </Box>
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
              <DataGridPro
                {...weeklyGrid}
                rows={weekly ?? []}
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
                  ...weeklyGrid.initialState,
                  sorting: { sortModel: [{ field: "hours", sort: "desc" }] },
                }}
                getRowId={(r) => r.id ?? r.rideId ?? r._id ?? `${r.pickupTime ?? r.start ?? 'row'}-${r.vehicle ?? ''}`}
              />
            </Box>
          )}
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
                  shootoutFiltered.map(({ _col, _id, ...rest }) => {
                    void _col;
                    void _id;
                    return {
                      ...rest,
                      startTime: fmtDateTimeMs(rest.startTime),
                      endTime: fmtDateTimeMs(rest.endTime),
                      createdAt: fmtDateTimeMs(rest.createdAt),
                      duration: fmtDuration(
                        rest.startTime,
                        rest.endTime,
                      ),
                    };
                  }),
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
            <DataGridPro
              {...shootGrid}
              rows={shootoutFiltered ?? []}
              columns={shootoutColumns}
              loading={!!loadingShootout}
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
                ...shootGrid.initialState,
                sorting: { sortModel: [{ field: "startTime", sort: "desc" }] },
              }}
              getRowId={(r) => r.id ?? r.rideId ?? r._id ?? `${r.pickupTime ?? r.start ?? 'row'}-${r.vehicle ?? ''}`}
            />
          </Box>
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
