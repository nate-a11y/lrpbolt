/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Paper, CircularProgress, Alert, Tabs, Tab } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { onSnapshot, collection } from "firebase/firestore";
import { db } from "../firebase";
import { isNil, tsToDate, fmtDateTime, firstKey, diffMinutes } from "../utils/timeUtilsSafe";
import { normalizeTimeLog, normalizeShootout } from "../utils/normalizeTimeLog";
import PageContainer from "./PageContainer.jsx";

const pickDriver = (r) =>
  firstKey(r, ["driverDisplay"]) ??
  firstKey(r?._raw, ["driverEmail", "driver", "userEmail", "user"]);

const pickRideId = (r) =>
  firstKey(r, ["rideId"]) ?? firstKey(r?._raw, ["rideId", "RideID", "tripId", "TripID"]);

const pickStart = (r) =>
  firstKey(r, ["startTime"]) ?? firstKey(r?._raw, ["startTime", "start", "clockIn", "startedAt"]);

const pickEnd = (r) =>
  firstKey(r, ["endTime"]) ?? firstKey(r?._raw, ["endTime", "end", "clockOut", "endedAt"]);

const pickCreated = (r) =>
  firstKey(r, ["createdAt"]) ?? firstKey(r?._raw, ["createdAt", "loggedAt", "startTime"]);

const pickDuration = (r) => {
  const stored = firstKey(r, ["durationMin"]) ?? firstKey(r?._raw, ["duration", "durationMin"]);
  if (!isNil(stored)) {
    const n = Number(stored);
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return diffMinutes(pickStart(r), pickEnd(r));
};

// ---------------- Data hooks ----------------
const useTimeLogs = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const col = collection(db, "timeLogs"); // do not orderBy; client-sort after normalize
      const unsub = onSnapshot(
        col,
        (snap) => {
          const data = [];
          snap.forEach((doc) => data.push(normalizeTimeLog(doc.id, doc.data() || {})));
          data.sort((a, b) => {
            const ta = tsToDate(pickCreated(a))?.getTime() ?? tsToDate(pickStart(a))?.getTime() ?? 0;
            const tb = tsToDate(pickCreated(b))?.getTime() ?? tsToDate(pickStart(b))?.getTime() ?? 0;
            return tb - ta; // desc
          });
          setRows(data);
          setLoading(false);
        },
        (err) => {
          setError(err?.message || "Failed to load time logs.");
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      setError(e?.message || "Failed to subscribe to time logs.");
      setLoading(false);
    }
  }, []);

  return { rows, loading, error };
};

const useShootoutStats = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const col = collection(db, "shootoutStats");
      const unsub = onSnapshot(
        col,
        (snap) => {
          const data = [];
          snap.forEach((doc) => data.push(normalizeShootout(doc.id, doc.data() || {})));
          data.sort((a, b) => {
            const ta = tsToDate(pickCreated(a))?.getTime() ?? tsToDate(pickStart(a))?.getTime() ?? 0;
            const tb = tsToDate(pickCreated(b))?.getTime() ?? tsToDate(pickStart(b))?.getTime() ?? 0;
            return tb - ta; // desc
          });
          setRows(data);
          setLoading(false);
        },
        (err) => {
          setError(err?.message || "Failed to load shootout stats.");
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      setError(e?.message || "Failed to subscribe to shootout stats.");
      setLoading(false);
    }
  }, []);

  return { rows, loading, error };
};

// ---------------- Column builders ----------------
const makeEntryColumns = () => [
  {
    field: "driver",
    headerName: "Driver",
    flex: 1,
    minWidth: 160,
    renderCell: (p = {}) => {
      const v = pickDriver(p?.row || {});
      return isNil(v) || v === "" ? "—" : String(v);
    },
    sortComparator: (a, b, pA, pB) =>
      String(pickDriver(pA?.row || {})).localeCompare(String(pickDriver(pB?.row || {}))),
  },
  {
    field: "rideId",
    headerName: "Ride ID",
    flex: 0.8,
    minWidth: 110,
    renderCell: (p = {}) => {
      const v = pickRideId(p?.row || {});
      return isNil(v) || v === "" ? "—" : String(v);
    },
  },
  {
    field: "start",
    headerName: "Start",
    type: "dateTime",
    flex: 1,
    minWidth: 190,
    renderCell: (p = {}) => fmtDateTime(pickStart(p?.row || {})),
    sortComparator: (a, b, pA, pB) =>
      (tsToDate(pickStart(pA?.row || {}))?.getTime() ?? -1) -
      (tsToDate(pickStart(pB?.row || {}))?.getTime() ?? -1),
  },
  {
    field: "end",
    headerName: "End",
    type: "dateTime",
    flex: 1,
    minWidth: 190,
    renderCell: (p = {}) => fmtDateTime(pickEnd(p?.row || {})),
    sortComparator: (a, b, pA, pB) =>
      (tsToDate(pickEnd(pA?.row || {}))?.getTime() ?? -1) -
      (tsToDate(pickEnd(pB?.row || {}))?.getTime() ?? -1),
  },
  {
    field: "duration",
    headerName: "Duration",
    flex: 0.7,
    minWidth: 120,
    renderCell: (p = {}) => {
      const m = pickDuration(p?.row || {});
      return isNil(m) ? "—" : `${m} min`;
    },
    sortComparator: (a, b, pA, pB) => {
      const na = pickDuration(pA?.row || {});
      const nb = pickDuration(pB?.row || {});
      return (isNil(na) ? -1 : na) - (isNil(nb) ? -1 : nb);
    },
  },
];

const buildWeeklySummary = (rows = []) => {
  const byDriver = new Map();
  for (const r of rows) {
    const driver = pickDriver(r) || "—";
    const key = driver.toString().toLowerCase().trim();
    if (!byDriver.has(key)) byDriver.set(key, { id: key, driver, trips: 0, minutes: 0 });
    const acc = byDriver.get(key);
    acc.trips += Number.isFinite(r?.trips) ? r.trips : 0;
    const m = pickDuration(r);
    acc.minutes += Number.isFinite(m) ? m : 0;
  }
  return [...byDriver.values()].map((x) => ({ ...x, hours: (x.minutes / 60).toFixed(2) }));
};

const makeShootoutColumns = () => [
  {
    field: "driver",
    headerName: "Driver",
    flex: 1,
    minWidth: 160,
    renderCell: (p = {}) => {
      const v = pickDriver(p?.row || {});
      return isNil(v) || v === "" ? "—" : String(v);
    },
  },
  {
    field: "trips",
    headerName: "Trips",
    type: "number",
    flex: 0.5,
    minWidth: 90,
    renderCell: (p = {}) => {
      const v = p?.row?.trips;
      return isNil(v) ? "—" : String(v);
    },
  },
  {
    field: "passengers",
    headerName: "Pax",
    type: "number",
    flex: 0.5,
    minWidth: 90,
    renderCell: (p = {}) => {
      const v = p?.row?.passengers;
      return isNil(v) ? "—" : String(v);
    },
  },
  {
    field: "duration",
    headerName: "Duration",
    flex: 0.7,
    minWidth: 120,
    renderCell: (p = {}) => {
      const m = pickDuration(p?.row || {});
      return isNil(m) ? "—" : `${m} min`;
    },
    sortComparator: (a, b, pA, pB) => {
      const na = pickDuration(pA?.row || {});
      const nb = pickDuration(pB?.row || {});
      return (isNil(na) ? -1 : na) - (isNil(nb) ? -1 : nb);
    },
  },
  {
    field: "status",
    headerName: "Status",
    flex: 0.7,
    minWidth: 110,
    renderCell: (p = {}) => {
      const v = firstKey(p?.row, ["status"]) ?? firstKey(p?.row?._raw, ["status"]);
      return isNil(v) ? "—" : String(v);
    },
  },
  {
    field: "start",
    headerName: "Start",
    type: "dateTime",
    flex: 1,
    minWidth: 190,
    renderCell: (p = {}) => fmtDateTime(pickStart(p?.row || {})),
    sortComparator: (a, b, pA, pB) =>
      (tsToDate(pickStart(pA?.row || {}))?.getTime() ?? -1) -
      (tsToDate(pickStart(pB?.row || {}))?.getTime() ?? -1),
  },
  {
    field: "end",
    headerName: "End",
    type: "dateTime",
    flex: 1,
    minWidth: 190,
    renderCell: (p = {}) => fmtDateTime(pickEnd(p?.row || {})),
    sortComparator: (a, b, pA, pB) =>
      (tsToDate(pickEnd(pA?.row || {}))?.getTime() ?? -1) -
      (tsToDate(pickEnd(pB?.row || {}))?.getTime() ?? -1),
  },
  {
    field: "created",
    headerName: "Created",
    type: "dateTime",
    flex: 1,
    minWidth: 190,
    renderCell: (p = {}) => fmtDateTime(pickCreated(p?.row || {})),
    sortComparator: (a, b, pA, pB) =>
      (tsToDate(pickCreated(pA?.row || {}))?.getTime() ?? -1) -
      (tsToDate(pickCreated(pB?.row || {}))?.getTime() ?? -1),
  },
];

export default function AdminTimeLog() {
  const [tab, setTab] = useState(0);
  const { rows: entryRows, loading: eload, error: eerr } = useTimeLogs();
  const { rows: shootRows, loading: sload, error: serr } = useShootoutStats();

  const summaryRows = useMemo(() => buildWeeklySummary(entryRows), [entryRows]);
  const entryColumns = useMemo(() => makeEntryColumns(), []);
  const shootoutColumns = useMemo(() => makeShootoutColumns(), []);
  const summaryColumns = useMemo(
    () => [
      {
        field: "driver",
        headerName: "Driver",
        flex: 1,
        minWidth: 160,
        renderCell: (p = {}) => {
          const v = p?.row?.driver;
          return isNil(v) || v === "" ? "—" : String(v);
        },
      },
      {
        field: "trips",
        headerName: "Trips",
        type: "number",
        flex: 0.5,
        minWidth: 90,
        renderCell: (p = {}) => {
          const v = p?.row?.trips;
          return isNil(v) ? "—" : String(v);
        },
      },
      {
        field: "hours",
        headerName: "Hours",
        type: "number",
        flex: 0.5,
        minWidth: 90,
        renderCell: (p = {}) => {
          const v = p?.row?.hours;
          return isNil(v) ? "—" : Number(v).toFixed(2);
        },
      },
    ],
    []
  );

  const renderEntries = () => {
    if (eload) return <Box p={2}><CircularProgress size={24} /></Box>;
    if (eerr) return <Box p={2}><Alert severity="error">{eerr}</Alert></Box>;
    return (
      <Paper sx={{ p: 1 }}>
        <div style={{ height: 640, width: "100%" }}>
          <DataGrid
            rows={entryRows ?? []}
            getRowId={(r) => r?.id ?? String(Math.random())}
            columns={entryColumns}
            disableRowSelectionOnClick
            initialState={{ sorting: { sortModel: [{ field: "start", sort: "desc" }] } }}
          />
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
          <DataGrid
            rows={shootRows ?? []}
            getRowId={(r) => r?.id ?? String(Math.random())}
            columns={shootoutColumns}
            disableRowSelectionOnClick
            initialState={{ sorting: { sortModel: [{ field: "start", sort: "desc" }] } }}
          />
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
