// src/components/AdminTimeLog.jsx
/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  IconButton,
  Tooltip,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  Snackbar,
  useMediaQuery,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import TableChartIcon from "@mui/icons-material/TableChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FlagIcon from "@mui/icons-material/Flag";
import SportsScoreIcon from "@mui/icons-material/SportsScore";
import { DataGrid } from "@mui/x-data-grid";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { durationFormat } from "../utils/timeUtils";
import { logError } from "../utils/logError";
import ErrorBanner from "./ErrorBanner";
import { collection, query, orderBy, Timestamp, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebaseInit"; // 🔒 singleton
import { useRole } from "@/hooks";
import { useAuth } from "../context/AuthContext.jsx";

dayjs.extend(isoWeek);

function tsToMillis(v) {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const baseColumns = [
  { field: "id", headerName: "#", width: 60 },
  { field: "Driver", headerName: "Driver", flex: 1 },
  { field: "RideID", headerName: "Ride ID", width: 130 },
  { field: "StartTime", headerName: "Start Time", flex: 1 },
  { field: "EndTime", headerName: "End Time", flex: 1 },
  { field: "Duration", headerName: "Duration", width: 110 },
  { field: "LoggedAt", headerName: "Logged At", flex: 1 },
];

const shootoutColumns = [
  { field: "id", headerName: "#", width: 60 },
  { field: "Driver", headerName: "Driver", flex: 1 },
  { field: "startTime", headerName: "Start Time", flex: 1 },
  { field: "endTime", headerName: "End Time", flex: 1 },
  { field: "elapsedMin", headerName: "Duration", width: 120 },
  { field: "createdAt", headerName: "Created", flex: 1 },
];

export default function AdminTimeLog() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // UI state
  const [tab, setTab] = useState(0);
  const [logs, setLogs] = useState([]);
  const [shootoutStats, setShootoutStats] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [columnVisibility, setColumnVisibility] = useState(() => {
    const saved = localStorage.getItem("logColumnVisibility");
    return saved ? JSON.parse(saved) : baseColumns.reduce((acc, c) => ({ ...acc, [c.field]: true }), {});
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" });

  // Auth & role
  const { role, authLoading: roleLoading } = useRole();
  const isAdmin = role === "admin";
  const { authLoading, user } = useAuth();

  // Firestore subscribe: timeLogs
  const [logDocs, setLogDocs] = useState(null);
  const [logsError, setLogsError] = useState(null);
  const [logsReady, setLogsReady] = useState(false);
  useEffect(() => {
    if (authLoading || roleLoading || !isAdmin || !user?.email) return;
    const q = query(collection(db, "timeLogs"), orderBy("loggedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLogDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLogsReady(true);
      },
      (e) => {
        setLogsError(e);
        setLogsReady(true);
      },
    );
    return () => unsub();
  }, [authLoading, roleLoading, isAdmin, user?.email]);

  // Firestore subscribe: shootoutStats
  const [shootDocs, setShootDocs] = useState(null);
  const [shootError, setShootError] = useState(null);
  const [shootReady, setShootReady] = useState(false);
  useEffect(() => {
    if (authLoading || roleLoading || !isAdmin || !user?.email) return;
    const q = query(collection(db, "shootoutStats"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setShootDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setShootReady(true);
      },
      (e) => {
        setShootError(e);
        setShootReady(true);
      },
    );
    return () => unsub();
  }, [authLoading, roleLoading, isAdmin, user?.email]);

  const error = logsError || shootError;
  const loading = !logsReady || !shootReady;

  // Error snackbar (single effect)
  useEffect(() => {
    if (!error) return;
    try { logError("FirestoreSubscribe AdminTimeLog", error); } catch (e) { /* logError handles itself */ }
    setSnackbar({ open: true, message: "Permissions issue reading logs.", severity: "error" });
  }, [error]);

  // Materialize rows when docs change
  useEffect(() => {
    if (!logDocs) return;
    setLogs(
      logDocs.map((entry, i) => {
        const start = dayjs(tsToMillis(entry.startTime));
        const end = dayjs(tsToMillis(entry.endTime));
        const logged = dayjs(tsToMillis(entry.loggedAt));
        const duration = start.isValid() && end.isValid() ? end.diff(start, "minute") : null;
        return {
          id: i + 1,
          Driver: entry.driver || "Unknown",
          RideID: entry.rideID || "N/A",
          StartTime: start.isValid() ? start.format("MM/DD/YYYY hh:mm A") : "—",
          EndTime: end.isValid() ? end.format("MM/DD/YYYY hh:mm A") : "—",
          Duration: duration != null ? durationFormat(duration) : "—",
          LoggedAt: logged.isValid() ? logged.format("MM/DD/YYYY hh:mm A") : "—",
          raw: entry,
          durationMin: duration ?? 0,
        };
      }),
    );
  }, [logDocs]);

  useEffect(() => {
    if (!shootDocs) return;
    setShootoutStats(
      shootDocs.map((entry, i) => {
        const start = dayjs(tsToMillis(entry.startTime));
        const end = dayjs(tsToMillis(entry.endTime));
        const created = dayjs(tsToMillis(entry.createdAt));
        const elapsed = start.isValid() && end.isValid() ? end.diff(start, "minute") : 0;
        return {
          id: i + 1,
          Driver: entry.driver || "Unknown",
          startTime: start.isValid() ? start.format("MM/DD/YYYY hh:mm A") : "—",
          endTime: end.isValid() ? end.format("MM/DD/YYYY hh:mm A") : "—",
          elapsedMin: durationFormat(elapsed),
          createdAt: created.isValid() ? created.format("MM/DD/YYYY hh:mm A") : "—",
        };
      }),
    );
  }, [shootDocs]);

  // Debounce search — MUST be before any return (hook order)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Derived rows (hooks BEFORE returns)
  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((r) => r.Driver.toLowerCase().includes(q) || r.RideID.toLowerCase().includes(q));
  }, [logs, search]);

  const groupedWeekly = useMemo(() => {
    const byDriver = {};
    for (const log of logs) {
      const week = dayjs(tsToMillis(log.raw?.startTime)).isoWeek();
      const driver = log.Driver;
      if (!byDriver[driver]) byDriver[driver] = {};
      if (!byDriver[driver][week]) byDriver[driver][week] = 0;
      byDriver[driver][week] += log.durationMin;
    }
    return byDriver;
  }, [logs]);

  const flaggedLogs = useMemo(() => {
    return logs.filter((log) => log.StartTime === "—" || log.EndTime === "—" || log.durationMin < 0 || log.durationMin > 720);
  }, [logs]);

  // ── After ALL hooks, do early returns ──────────────────────────────────────
  if (roleLoading) {
    return (
      <Box mt={4} display="flex" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }
  if (!isAdmin) {
    return (
      <Box mt={4}>
        <Alert severity="error">You don’t have permission to view this.</Alert>
      </Box>
    );
  }
  if (loading) {
    return (
      <Box mt={4} display="flex" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }
  // ───────────────────────────────────────────────────────────────────────────

  const renderTopBar = (
    <Paper sx={{ p: 2, mb: 2, borderLeft: "5px solid #4cbb17" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
        <TextField
          label="Search by Driver or Ride ID"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          InputProps={{
            endAdornment: (
              <Tooltip title="Search">
                <SearchIcon color="action" />
              </Tooltip>
            ),
          }}
          size="small"
          sx={{ flex: 1 }}
        />
        <Tooltip title="Reload Data">
          <IconButton
            onClick={() => {
              // trigger refetch by toggling readiness flags; snapshots will resend
              setLogsReady(false);
              setShootReady(false);
            }}
            sx={{
              "@keyframes spin": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
              animation: "spin 0.8s linear",
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );

  return (
    <>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ px: { xs: 1, sm: 2 }, py: 3 }}>
          <ErrorBanner error={error} />

          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            TabIndicatorProps={{ style: { backgroundColor: "#4cbb17", height: 3 } }}
            sx={{ mb: 2 }}
          >
            <Tab label="Log Table" icon={<TableChartIcon />} iconPosition="start" />
            <Tab label="Weekly Summary" icon={<CalendarMonthIcon />} iconPosition="start" />
            <Tab label="Flagged Issues" icon={<FlagIcon />} iconPosition="start" />
            <Tab label="Shootout Stats" icon={<SportsScoreIcon />} iconPosition="start" />
          </Tabs>

          {tab === 0 && (
            <>
              {renderTopBar}
              <Paper>
                <DataGrid
                  autoHeight
                  rows={filteredLogs}
                  columns={baseColumns}
                  columnVisibilityModel={columnVisibility}
                  onColumnVisibilityModelChange={(m) => setColumnVisibility(m)}
                  pageSizeOptions={[5, 10, 20, 50]}
                  sortingOrder={["asc", "desc"]}
                  getRowClassName={(params) => (params.indexRelativeToCurrentPage % 2 === 0 ? "even" : "odd")}
                  sx={{
                    "& .even": {
                      backgroundColor: isDark ? "#333" : "grey.100",
                    },
                    "& .odd": { backgroundColor: "transparent" },
                    "& .MuiDataGrid-row:hover": {
                      backgroundColor: isDark ? "#444" : "grey.200",
                    },
                    backgroundColor: isDark ? "#2a2a2a" : "#fafafa",
                    fontSize: "0.85rem",
                  }}
                />
                {filteredLogs.length === 0 && (
                  <Typography textAlign="center" color="text.secondary" sx={{ p: 2 }}>
                    No logs found.
                  </Typography>
                )}
              </Paper>
            </>
          )}

          {tab === 1 && (
            <Paper sx={{ p: 2, borderLeft: "5px solid #4cbb17" }}>
              <Typography variant="h6" mb={2}>Weekly Summary</Typography>
              {Object.entries(groupedWeekly).map(([driver, weeks]) => (
                <Box key={driver} mb={2}>
                  <Typography fontWeight={600}>{driver}</Typography>
                  {Object.entries(weeks).map(([week, total]) => (
                    <Typography key={week} ml={2}>Week {week}: {durationFormat(total)}</Typography>
                  ))}
                </Box>
              ))}
            </Paper>
          )}

          {tab === 2 && (
            <Paper sx={{ p: 2, borderLeft: "5px solid red" }}>
              <Typography variant="h6" mb={2}>Flagged Entries (Missing or Suspicious Durations)</Typography>
              <DataGrid
                autoHeight
                rows={flaggedLogs}
                columns={baseColumns}
                pageSizeOptions={[5, 10, 20]}
                sx={{
                  backgroundColor: isDark ? "#2a2a2a" : "#fff",
                  "& .MuiDataGrid-row:nth-of-type(odd)": {
                    backgroundColor: isDark ? "#333" : "grey.100",
                  },
                  "& .MuiDataGrid-row:hover": {
                    backgroundColor: isDark ? "#444" : "grey.200",
                  },
                }}
              />
            </Paper>
          )}

          {tab === 3 && (
            <Paper sx={{ p: 2, borderLeft: "5px solid #ffa500" }}>
              <Typography variant="h6" mb={2}>Shootout Session History</Typography>
              <DataGrid
                autoHeight
                rows={shootoutStats}
                columns={shootoutColumns}
                pageSizeOptions={[5, 10, 20]}
                sx={{
                  backgroundColor: isDark ? "#2a2a2a" : "#fff",
                  "& .MuiDataGrid-row:nth-of-type(odd)": {
                    backgroundColor: isDark ? "#333" : "grey.100",
                  },
                  "& .MuiDataGrid-row:hover": {
                    backgroundColor: isDark ? "#444" : "grey.200",
                  },
                }}
              />
              {shootoutStats.length === 0 && (
                <Typography textAlign="center" color="text.secondary" sx={{ p: 2 }}>
                  No shootout stats.
                </Typography>
              )}
            </Paper>
          )}
        </Box>
      </LocalizationProvider>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

