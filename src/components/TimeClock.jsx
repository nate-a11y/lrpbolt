// src/components/TimeClockGodMode.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Box, Paper, TextField, Button, Typography, Checkbox,
  FormControlLabel, Tooltip, Snackbar, Alert, Stack,
  CircularProgress
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon
} from "@mui/icons-material";
import dayjs from "dayjs";
import { logTime, subscribeTimeLogs } from "../hooks/api";
import { Timestamp } from "firebase/firestore";

const bcName = "lrp-timeclock-lock";

export default function TimeClockGodMode({ driver, setIsTracking }) {
  const [rideId, setRideId] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isNA, setIsNA] = useState(false);
  const [isMulti, setIsMulti] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState([]);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const unsubRef = useRef(null);
  const bcRef = useRef(null);

  // Restore session
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("lrp_timeTrack") || "{}");
    if (stored.driver === driver && stored.startTime) {
      setRideId(stored.rideId || "");
      setStartTime(dayjs(stored.startTime));
      setIsRunning(true);
      setIsNA(stored.isNA || false);
      setIsMulti(stored.isMulti || false);
    }
  }, [driver]);

  // BroadcastChannel for locking
  useEffect(() => {
    const bc = new BroadcastChannel(bcName);
    bcRef.current = bc;

    bc.onmessage = (e) => {
      if (e?.data?.type === "timeclock:started" && e.data.driver === driver) {
        if (!isRunning) {
          const s = e.data.payload;
          setRideId(s.rideId || "");
          setStartTime(dayjs(s.startTime));
          setIsNA(s.isNA);
          setIsMulti(s.isMulti);
          setIsRunning(true);
        }
      }
      if (e?.data?.type === "timeclock:ended" && e.data.driver === driver) {
        setIsRunning(false);
        setEndTime(dayjs(e.data.payload.endTime));
        localStorage.removeItem("lrp_timeTrack");
      }
    };

    return () => {
      bc.close();
    };
  }, [driver, isRunning]);

  // Update tracking state globally
  useEffect(() => {
    setIsTracking(isRunning);
  }, [isRunning, setIsTracking]);

  // Elapsed time
  useEffect(() => {
    if (!isRunning || !startTime) return;
    const timer = setInterval(() => {
      setElapsed(dayjs().diff(startTime, "second"));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, startTime]);

  // Subscribe to logs
  useEffect(() => {
    if (unsubRef.current) {
      try { unsubRef.current(); } catch {}
      unsubRef.current = null;
    }
    unsubRef.current = subscribeTimeLogs(setLogs, driver);
    return () => {
      if (unsubRef.current) {
        try { unsubRef.current(); } catch {}
      }
    };
  }, [driver]);

  const formatElapsed = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const handleStart = () => {
    if (!driver || (!rideId && !isNA && !isMulti)) {
      return setSnack({ open: true, message: "Enter Ride ID or select a mode", severity: "error" });
    }

    if (isRunning) return;
    const now = dayjs();
    const idToTrack = isNA ? "N/A" : isMulti ? "MULTI" : rideId.trim().toUpperCase();

    setStartTime(now);
    setEndTime(null);
    setIsRunning(true);
    setSubmitting(true);

    localStorage.setItem("lrp_timeTrack", JSON.stringify({
      driver,
      rideId: idToTrack,
      isNA,
      isMulti,
      startTime: now.toISOString()
    }));

    bcRef.current?.postMessage({
      type: "timeclock:started",
      driver,
      payload: { rideId: idToTrack, isNA, isMulti, startTime: now.toISOString() }
    });

    setTimeout(() => setSubmitting(false), 600);
  };

  const handleEnd = async () => {
    if (!isRunning || !startTime) return;

    const end = dayjs();
    setEndTime(end);
    setIsRunning(false);
    setSubmitting(true);

    const payload = {
      driver,
      rideId: isNA ? "N/A" : isMulti ? "MULTI" : rideId.trim().toUpperCase(),
      startTime: Timestamp.fromDate(startTime.toDate()),
      endTime: Timestamp.fromDate(end.toDate()),
      duration: Math.max(1, end.diff(startTime, "minute")),
      createdAt: Timestamp.now()
    };

    try {
      const res = await logTime(payload);
      if (res?.success) {
        setSnack({ open: true, message: "✅ Time logged", severity: "success" });
        localStorage.removeItem("lrp_timeTrack");
        setRideId("");
        setIsNA(false);
        setIsMulti(false);
        setElapsed(0);
        bcRef.current?.postMessage({ type: "timeclock:ended", driver, payload: { endTime: end.toISOString() } });
      } else {
        throw new Error(res?.message || "Unknown error");
      }
    } catch (err) {
      setSnack({ open: true, message: `❌ Failed: ${err.message}`, severity: "error" });
      setIsRunning(true); // visually restore running state if failed
    }
    setSubmitting(false);
  };

  const columns = [
    { field: "rideId", headerName: "Ride ID", flex: 1 },
    { field: "start", headerName: "Start Time", flex: 1.5 },
    { field: "end", headerName: "End Time", flex: 1.5 },
    { field: "duration", headerName: "Duration", flex: 1 }
  ];

  const rows = useMemo(() => {
    return logs.map((s, i) => ({
      id: i,
      rideId: s.rideId,
      start: dayjs(s.start?.toDate?.()).format("MM/DD hh:mm A"),
      end: dayjs(s.end?.toDate?.()).format("MM/DD hh:mm A"),
      duration: `${s.duration || 0}m`
    }));
  }, [logs]);

  return (
    <Box maxWidth={600} mx="auto" p={2}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Time Clock</Typography>

        <TextField
          label="Ride ID"
          fullWidth
          disabled={isRunning || isNA || isMulti}
          value={rideId}
          onChange={(e) => setRideId(e.target.value.trimStart())}
          helperText="Enter Ride ID or select a task type"
        />

        <FormControlLabel
          control={<Checkbox checked={isNA} onChange={(e) => {
            setIsNA(e.target.checked);
            if (e.target.checked) setIsMulti(false);
          }} disabled={isRunning} />}
          label="N/A – Non-Ride Task"
        />

        <FormControlLabel
          control={<Checkbox checked={isMulti} onChange={(e) => {
            setIsMulti(e.target.checked);
            if (e.target.checked) setIsNA(false);
          }} disabled={isRunning} />}
          label="Multiple Back-to-Back Rides"
        />

        <Stack direction="row" spacing={2} mt={2}>
          <Button
            fullWidth
            onClick={handleStart}
            disabled={isRunning || submitting}
            startIcon={<PlayArrowIcon />}
            variant="contained"
            color="success"
          >
            {submitting && !isRunning ? "Starting…" : "Start"}
          </Button>
          <Button
            fullWidth
            onClick={handleEnd}
            disabled={!isRunning || submitting}
            startIcon={<StopIcon />}
            variant="contained"
            color="error"
          >
            {submitting && isRunning ? "Logging…" : "End"}
          </Button>
        </Stack>

        {isRunning && (
          <Typography mt={2} color="success.main">
            🟢 Started at {startTime?.format("HH:mm")} — Elapsed: {formatElapsed(elapsed)}
          </Typography>
        )}
        {!isRunning && endTime && (
          <Typography mt={2} color="text.secondary">
            Ended at {endTime?.format("HH:mm")}
          </Typography>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1">Previous Sessions</Typography>
          <Button
            onClick={() => {
              setRefreshing(true);
              unsubRef.current?.();
              setTimeout(() => {
                unsubRef.current = subscribeTimeLogs(setLogs, driver);
                setRefreshing(false);
              }, 500);
            }}
            size="small"
            startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </Box>

        <DataGrid
          autoHeight
          rows={rows}
          columns={columns}
          pageSizeOptions={[5]}
          initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
          disableRowSelectionOnClick
          density="compact"
        />
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
