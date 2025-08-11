// src/components/AdminTimeLog.jsx
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
  Menu,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
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
import { durationFormat, tsToMillis } from "../utils/timeUtils";
import { logError } from "../utils/logError";
import ErrorBanner from "./ErrorBanner";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import useRole from "../hooks/useRole";
import useFirestoreSub from "../hooks/useFirestoreSub";

dayjs.extend(isoWeek);

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

  const [tab, setTab] = useState(0);
  const [logs, setLogs] = useState([]);
  const [shootoutStats, setShootoutStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [columnVisibility, setColumnVisibility] = useState(() => {
    const saved = localStorage.getItem("logColumnVisibility");
    return saved
      ? JSON.parse(saved)
      : baseColumns.reduce((acc, c) => ({ ...acc, [c.field]: true }), {});
  });

  const { isAdmin, loading: roleLoading } = useRole();
  const { data: logDocs, error: logsError } = useFirestoreSub(
    () => {
      if (roleLoading || !isAdmin) return null;
      return query(collection(db, "timeLogs"), orderBy("loggedAt", "desc"));
    },
    [roleLoading, isAdmin],
  );
  const { data: shootDocs, error: shootError } = useFirestoreSub(
    () => {
      if (roleLoading || !isAdmin) return null;
      return query(collection(db, "shootoutStats"), orderBy("createdAt", "desc"));
    },
    [roleLoading, isAdmin],
  );

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
    setLoading(false);
    setErr(null);
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
          startTime: start.format("MM/DD/YYYY hh:mm A"),
          endTime: end.format("MM/DD/YYYY hh:mm A"),
          elapsedMin: durationFormat(elapsed),
          createdAt: created.format("MM/DD/YYYY hh:mm A"),
        };
      }),
    );
  }, [shootDocs]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      setErr("permission-denied");
      setLoading(false);
    }
  }, [roleLoading, isAdmin]);

  useEffect(() => {
    const e = logsError || shootError;
    if (!e) return;
    logError(e, { area: "FirestoreSubscribe", comp: "AdminTimeLog" });
    if (e.code === "permission-denied") {
      setErr("permission-denied");
    } else {
      setErr(e.code || e.message || "Unknown error");
    }
    setLoading(false);
  }, [logsError, shootError]);

  if (err === "permission-denied") {
    return (
      <Box mt={4} textAlign="center">
        <ErrorBanner error={err} onClose={() => setErr(null)} />
        <Alert severity="error">Admins only</Alert>
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

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    return logs.filter(
      (r) =>
        r.Driver.toLowerCase().includes(search.toLowerCase()) ||
        r.RideID.toLowerCase().includes(search.toLowerCase())
    );
  }, [logs, search]);

  const groupedWeekly = useMemo(() => {
    const byDriver = {};
    for (const log of logs) {
      const week = dayjs(tsToMillis(log.raw.startTime)).isoWeek();
      const driver = log.Driver;
      if (!byDriver[driver]) byDriver[driver] = {};
      if (!byDriver[driver][week]) byDriver[driver][week] = 0;
      byDriver[driver][week] += log.durationMin;
    }
    return byDriver;
  }, [logs]);

  const flaggedLogs = useMemo(() => {
    return logs.filter((log) => {
      return (
        log.StartTime === "—" ||
        log.EndTime === "—" ||
        log.durationMin < 0 ||
        log.durationMin > 720
      );
    });
  }, [logs]);

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
            onClick={() => setLoading(true)}
            sx={{
              animation: loading ? "spin 2s linear infinite" : "none",
              "@keyframes spin": {
                from: { transform: "rotate(0deg)" },
                to: { transform: "rotate(360deg)" },
              },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ px: { xs: 1, sm: 2 }, py: 3 }}>
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
                getRowClassName={(params) =>
                  params.indexRelativeToCurrentPage % 2 === 0 ? "even" : "odd"
                }
                sx={{
                  "& .even": { backgroundColor: isDark ? "#333" : "grey.100" },
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
            <Typography variant="h6" mb={2}>
              Weekly Summary
            </Typography>
            {Object.entries(groupedWeekly).map(([driver, weeks]) => (
              <Box key={driver} mb={2}>
                <Typography fontWeight={600}>{driver}</Typography>
                {Object.entries(weeks).map(([week, total]) => (
                  <Typography key={week} ml={2}>
                    Week {week}: {durationFormat(total)}
                  </Typography>
                ))}
              </Box>
            ))}
          </Paper>
        )}

        {tab === 2 && (
          <Paper sx={{ p: 2, borderLeft: "5px solid red" }}>
            <Typography variant="h6" mb={2}>
              Flagged Entries (Missing or Suspicious Durations)
            </Typography>
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
            <Typography variant="h6" mb={2}>
              Shootout Session History
            </Typography>
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
      <ErrorBanner error={err} onClose={() => setErr(null)} />
    </LocalizationProvider>
  );
}
