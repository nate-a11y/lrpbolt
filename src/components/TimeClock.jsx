/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Snackbar,
  Alert,
  Chip,
  Stack,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import { logTime, subscribeTimeLogs } from "../hooks/api";
import { logError } from "../utils/logError";
import { Timestamp } from "firebase/firestore";

const bcName = "lrp-timeclock-lock";

function toJSDate(maybeTs) {
  if (!maybeTs) return null;
  // Firestore Timestamp
  if (typeof maybeTs.toDate === "function") return maybeTs.toDate();
  // ISO string or ms number
  return new Date(maybeTs);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function TimeClock({ driver, setIsTracking }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [rideId, setRideId] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isNA, setIsNA] = useState(false);
  const [isMulti, setIsMulti] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [previousSessions, setPreviousSessions] = useState([]);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // subscription control for refresh
  const unsubRef = useRef(null);
  const subKeyRef = useRef(0);

  // cross-tab lock
  const bcRef = useRef(null);

  const showSnack = (message, severity = "success") =>
    setSnack({ open: true, message, severity });

  // Restore in‑progress session from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("lrp_timeTrack") || "{}");
      if (stored.driver === driver && stored.startTime) {
        setRideId(stored.rideId || "");
        setStartTime(dayjs(stored.startTime));
        setIsRunning(true);
        setIsNA(stored.isNA || false);
        setIsMulti(stored.isMulti || false);
      }
    } catch (e) {
      logError(e, "TimeClock:restore");
    }
  }, [driver]);

  // cross‑tab single‑session lock
  useEffect(() => {
    const bc = new BroadcastChannel(bcName);
    bcRef.current = bc;

    const onMsg = (evt) => {
      if (evt?.data?.type === "timeclock:started" && evt.data.driver === driver) {
        // another tab started – sync UI
        if (!isRunning) {
          const s = evt.data.payload || {};
          setRideId(s.rideId || "");
          setStartTime(dayjs(s.startTime));
          setIsNA(s.isNA || false);
          setIsMulti(s.isMulti || false);
          setIsRunning(true);
        }
      }
      if (evt?.data?.type === "timeclock:ended" && evt.data.driver === driver) {
        setIsRunning(false);
        setEndTime(dayjs(evt.data.payload?.endTime));
        localStorage.removeItem("lrp_timeTrack");
      }
    };

    bc.addEventListener("message", onMsg);
    return () => {
      bc.removeEventListener("message", onMsg);
      bc.close();
    };
  }, [driver, isRunning]);

  useEffect(() => {
    setIsTracking(isRunning);
  }, [isRunning, setIsTracking]);

  useEffect(() => {
    let timer;
    if (isRunning && startTime) {
      timer = setInterval(() => {
        setElapsedTime(dayjs().diff(startTime, "second"));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, startTime]);

  // Subscribe to time logs (and re-sub on refresh)
  useEffect(() => {
    // cleanup previous sub if any
    if (unsubRef.current) {
      try { unsubRef.current(); } catch {}
      unsubRef.current = null;
    }
    const unsub = subscribeTimeLogs(
      (logs) => {
        setPreviousSessions(logs || []);
        setIsRefreshing(false);
      },
      driver
    );
    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) {
        try { unsubRef.current(); } catch {}
        unsubRef.current = null;
      }
    };
  }, [driver, subKeyRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = () => {
    if (!driver || (!rideId && !isNA && !isMulti)) {
      return showSnack("Please enter a Ride ID or check N/A / Multiple", "error");
    }
    // prevent double‑start across tabs
    if (isRunning) return;

    const now = dayjs();
    const idToTrack = isNA ? "N/A" : isMulti ? "MULTI" : rideId.trim().toUpperCase();

    setStartTime(now);
    setEndTime(null);
    setIsRunning(true);
    setIsSubmitting(true);

    localStorage.setItem(
      "lrp_timeTrack",
      JSON.stringify({
        driver,
        rideId: idToTrack,
        isNA,
        isMulti,
        startTime: now.toISOString(),
      })
    );

    // broadcast to other tabs
    bcRef.current?.postMessage({
      type: "timeclock:started",
      driver,
      payload: { rideId: idToTrack, isNA, isMulti, startTime: now.toISOString() },
    });

    setTimeout(() => setIsSubmitting(false), 600);
  };

  const logTimeWithRetry = useCallback(
    async (payload) => {
      const maxAttempts = 4;
      let attempt = 0;
      // jittered exponential backoff
      while (true) {
        try {
          const res = await logTime(payload);
          if (res?.success) return res;
          throw new Error(res?.message || "Unknown failure");
        } catch (err) {
          attempt += 1;
          if (attempt >= maxAttempts) throw err;
          const wait = Math.min(3000, 300 * 2 ** (attempt - 1)) + Math.random() * 250;
          await sleep(wait);
        }
      }
    },
    []
  );

  const handleEnd = async () => {
    if (!isRunning || !startTime) return;
    const end = dayjs();
    setEndTime(end);
    setIsRunning(false);
    setIsSubmitting(true);

    const rawMinutes = end.diff(startTime, "minute");
    const duration = Math.max(1, rawMinutes); // clamp to >= 1 minute

    const payload = {
      driver,
      rideId: isNA ? "N/A" : isMulti ? "MULTI" : rideId.trim().toUpperCase(),
      startTime: Timestamp.fromDate(startTime.toDate()),
      endTime: Timestamp.fromDate(end.toDate()),
      duration,
    };

    try {
      const data = await logTimeWithRetry(payload);
      if (data.success) {
        showSnack("✅ Time successfully logged!");
        localStorage.removeItem("lrp_timeTrack");
        setRideId("");
        setIsNA(false);
        setIsMulti(false);
        setElapsedTime(0);
        // broadcast end
        bcRef.current?.postMessage({
          type: "timeclock:ended",
          driver,
          payload: { endTime: end.toISOString() },
        });
      } else {
        showSnack(`❌ Failed to log time: ${data.message}`, "error");
      }
    } catch (err) {
      logError(err, "TimeClock:logTime");
      showSnack("❌ Network error: " + (err?.message || JSON.stringify(err)), "error");
      // put us visually back into running if write failed
      setIsRunning(true);
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  };

  const formatElapsed = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h${mins ? ` ${mins}m` : ""}`;
  };

  const columns = [
    {
      field: "rideId",
      headerName: "Ride ID",
      flex: 1,
      renderCell: ({ row }) => {
        let color = "default";
        if (row.rideIdRaw === "N/A") color = "warning";
        else if (row.rideIdRaw === "MULTI") color = "info";
        else color = "success";
        return (
          <Tooltip
            title={
              row.rideIdRaw === "N/A"
                ? "Non-Ride Task"
                : row.rideIdRaw === "MULTI"
                ? "Multiple Back-to-Back Rides"
                : `Ride ID: ${row.rideIdRaw}`
            }
          >
            <Chip label={row.rideId} color={color} size="small" />
          </Tooltip>
        );
      },
    },
    { field: "start", headerName: "Start Time", flex: 1.5 },
    { field: "end", headerName: "End Time", flex: 1.5 },
    { field: "duration", headerName: "Duration", flex: 1 },
  ];

  const rows = useMemo(() => {
    return (previousSessions || []).map((s, i) => {
      const rawId = s.rideId || "N/A";
      const startJs = toJSDate(s.start);
      const endJs = toJSDate(s.end);
      return {
        id: i,
        rideIdRaw: rawId,
        rideId: rawId === "N/A" ? "N/A" : rawId === "MULTI" ? "Multiple" : rawId,
        start: startJs ? dayjs(startJs).format("MM/DD/YYYY hh:mm A") : "—",
        end: endJs ? dayjs(endJs).format("MM/DD/YYYY hh:mm A") : "—",
        duration: formatDuration(parseInt(s.duration, 10)),
      };
    });
  }, [previousSessions]);

  return (
    <Box maxWidth={600} mx="auto">
      <style>{`
        @keyframes pulse { 0% { transform: scale(1); opacity: .75 } 50% { transform: scale(1.25); opacity: 1 } 100% { transform: scale(1); opacity: .75 } }
      `}</style>

      <Paper
        elevation={3}
        sx={{
          p: 3,
          borderLeft: "5px solid #4cbb17",
          bgcolor: isDark ? "#1d1d1d" : "#fafafa",
        }}
      >
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <MenuBookIcon fontSize="small" /> How to Use The Time Tracker & Moovs
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" gutterBottom>
              ⏱️ Use <strong>Start</strong> when you begin working. If it&apos;s not for a ride, check <strong>N/A</strong>.
            </Typography>
            <Typography variant="body2" gutterBottom>
              ✨ Start the trip in Moovs when you&apos;re actually en route, not while prepping.
            </Typography>
            <Typography variant="body2" gutterBottom>
              🛑 Press <strong>End</strong> when finished to log your time.
            </Typography>
            <Typography variant="body2" gutterBottom>
              🦒 For back-to-back rides, use <strong>Multiple Back-to-Back Rides</strong>.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Typography variant="h6" mb={2}>⏱️ Time Clock</Typography>

        <Stack spacing={1}>
          <Tooltip title="Enter the Ride ID if this session relates to a specific trip.">
            <span>
              <TextField
                label="Ride ID"
                value={rideId}
                onChange={(e) => setRideId(e.target.value.trimStart())}
                fullWidth
                margin="normal"
                disabled={isRunning || isNA || isMulti}
                helperText="Enter Ride ID or select a task type."
              />
            </span>
          </Tooltip>

          <Tooltip title="For administrative or support tasks.">
            <span>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isNA}
                    onChange={(e) => {
                      setIsNA(e.target.checked);
                      if (e.target.checked) setIsMulti(false);
                    }}
                    disabled={isRunning}
                  />
                }
                label="N/A – Non-Ride Task"
              />
            </span>
          </Tooltip>

          <Tooltip title="Clock in once for consecutive rides.">
            <span>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isMulti}
                    onChange={(e) => {
                      setIsMulti(e.target.checked);
                      if (e.target.checked) setIsNA(false);
                    }}
                    disabled={isRunning}
                  />
                }
                label="Multiple Back-to-Back Rides"
              />
            </span>
          </Tooltip>
        </Stack>

        <Box mt={2} display="flex" gap={2}>
          <Button
            fullWidth
            disabled={isRunning || isSubmitting}
            onClick={handleStart}
            variant="contained"
            color="success"
            startIcon={<PlayArrowIcon />}
          >
            {isSubmitting && !isRunning ? "Starting..." : "Start"}
          </Button>
          <Button
            fullWidth
            disabled={!isRunning || isSubmitting}
            onClick={handleEnd}
            color="error"
            variant="contained"
            startIcon={<StopIcon />}
          >
            {isSubmitting && isRunning ? "Logging..." : "End"}
          </Button>
        </Box>

        <Box mt={2}>
          {isRunning && (
            <Typography color="success.main" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <span style={{ animation: "pulse 1.5s infinite", fontSize: "1.2rem" }}>🟢</span>
              Started at {startTime?.format("HH:mm")} — Elapsed: {formatElapsed(elapsedTime)}
            </Typography>
          )}
          {!isRunning && endTime && (
            <Typography color="primary.main">Ended at {endTime?.format("HH:mm")}</Typography>
          )}
        </Box>
      </Paper>

      <Box mt={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1">📋 Previous Sessions</Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setIsRefreshing(true);
              // flip key -> triggers useEffect to resubscribe
              subKeyRef.current += 1;
              showSnack("🔄 Refreshing…", "info");
            }}
            startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            disabled={isRefreshing}
          >
            Refresh
          </Button>
        </Box>

        <Paper elevation={2} sx={{ p: 1, backgroundColor: isDark ? "#1e1e1e" : "#fff" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            autoHeight
            initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
            pageSizeOptions={[5, 10, 25]}
            disableRowSelectionOnClick
            disableColumnMenu
            density="compact"
            sx={{
              backgroundColor: isDark ? "#2a2a2a" : "#fafafa",
              fontSize: "0.9rem",
              "& .MuiDataGrid-overlay": { textAlign: "center", pt: 4 },
              "& .MuiDataGrid-row:nth-of-type(even)": {
                backgroundColor: isDark ? "#1e1e1e" : "#f5f5f5",
              },
            }}
          />
        </Paper>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
