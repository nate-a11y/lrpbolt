// src/components/TimeClockGodMode.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  Box, Paper, TextField, Button, Typography, Checkbox,
  FormControlLabel, Snackbar, Alert, Stack
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon
} from "@mui/icons-material";
import dayjs from "dayjs";
import {
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  doc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { waitForAuth } from "../utils/waitForAuth";

const bcName = "lrp-timeclock-lock";

async function logTimeCreate(payload) {
  const user = await waitForAuth(true);
  const userEmail = (user.email || "").toLowerCase();

  return addDoc(collection(db, "timeLogs"), {
    userEmail,
    driverId: payload.driverId ?? null,
    startTime: payload.startTime instanceof Timestamp ? payload.startTime : serverTimestamp(),
    endTime: payload.endTime ?? null,
    rideId: payload.rideId ?? null,
    mode: payload.mode ?? "N/A",
    createdAt: serverTimestamp(),
  });
}

async function logTimeUpdate(id, patch) {
  await waitForAuth(true);
  return updateDoc(doc(db, "timeLogs", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export default function TimeClockGodMode({ driver, setIsTracking }) {
  const [rideId, setRideId] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isNA, setIsNA] = useState(false);
  const [isMulti, setIsMulti] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rows, setRows] = useState([]);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [submitting, setSubmitting] = useState(false);
  const [logId, setLogId] = useState(null);
  const bcRef = useRef(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("lrp_timeTrack") || "{}");
    if (stored.driver === driver && stored.startTime) {
      setRideId(stored.rideId || "");
      setStartTime(Timestamp.fromMillis(stored.startTime));
      setIsRunning(true);
      setIsNA(stored.isNA || false);
      setIsMulti(stored.isMulti || false);
      setLogId(stored.logId || null);
    }
  }, [driver]);

  useEffect(() => {
    const bc = new BroadcastChannel(bcName);
    bcRef.current = bc;

    bc.onmessage = (e) => {
      if (e?.data?.type === "timeclock:started" && e.data.driver === driver) {
        if (!isRunning) {
          const s = e.data.payload;
          setRideId(s.rideId || "");
          setStartTime(Timestamp.fromMillis(s.startTime));
          setIsNA(s.isNA);
          setIsMulti(s.isMulti);
          setIsRunning(true);
        }
      }
      if (e?.data?.type === "timeclock:ended" && e.data.driver === driver) {
        setIsRunning(false);
        setEndTime(Timestamp.fromMillis(e.data.payload.endTime));
        localStorage.removeItem("lrp_timeTrack");
      }
    };

    return () => bc.close();
  }, [driver, isRunning]);

  useEffect(() => {
    setIsTracking(isRunning);
  }, [isRunning, setIsTracking]);

  useEffect(() => {
    if (!isRunning || !startTime) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Timestamp.now().toMillis() - startTime.toMillis()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, startTime]);

  useEffect(() => {
    let unsub = () => {};
    let mounted = true;
    (async () => {
      try {
        const user = await waitForAuth(true);
        if (!mounted) return;
        const userEmail = (user.email || "").toLowerCase();
        const isAdmin = (driver?.access || "").toLowerCase() === "admin";

        const base = collection(db, "timeLogs");
        const q = isAdmin
          ? query(base, orderBy("startTime", "desc"), limit(500))
          : query(base, where("userEmail", "==", userEmail), orderBy("startTime", "desc"), limit(200));

        unsub = onSnapshot(q, (snap) => {
          const rows = snap.docs.map((d) => {
            const data = d.data();
            const st = data.startTime && data.startTime.toDate ? data.startTime.toDate() : null;
            const et = data.endTime && data.endTime.toDate ? data.endTime.toDate() : null;
            const duration = st && et ? Math.round((et - st) / 60000) : 0;
            return { id: d.id, ...data, startTime: st, endTime: et, duration };
          });
          setRows(rows);
        });
      } catch (e) {
        console.error("timeLogs subscribe failed", e);
        // TODO: surface snackbar
      }
    })();
    return () => {
      mounted = false;
      try {
        unsub();
      } catch (e) {}
    };
  }, [driver?.access]);

  const formatElapsed = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const handleStart = async () => {
    if (!driver || (!rideId && !isNA && !isMulti)) {
      return setSnack({ open: true, message: "Enter Ride ID or select a mode", severity: "error" });
    }
    if (isRunning) return;

    const now = Timestamp.now();
    const idToTrack = isNA ? "N/A" : isMulti ? "MULTI" : rideId.trim().toUpperCase();
    setSubmitting(true);
    try {
      const ref = await logTimeCreate({
        driverId: driver,
        rideId: idToTrack,
        mode: isNA ? "N/A" : isMulti ? "MULTI" : "RIDE",
      });
      setLogId(ref.id);
      setStartTime(now);
      setEndTime(null);
      setIsRunning(true);
      localStorage.setItem(
        "lrp_timeTrack",
        JSON.stringify({
          driver,
          rideId: idToTrack,
          isNA,
          isMulti,
          startTime: now.toMillis(),
          logId: ref.id,
        })
      );
      bcRef.current?.postMessage({
        type: "timeclock:started",
        driver,
        payload: {
          rideId: idToTrack,
          isNA,
          isMulti,
          startTime: now.toMillis(),
          logId: ref.id,
        },
      });
    } catch (e) {
      console.error("logTimeCreate failed", e);
      setSnack({ open: true, message: `❌ Failed: ${e.message}`, severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnd = async () => {
    if (!isRunning || !startTime || !logId) return;

    const end = Timestamp.now();
    setEndTime(end);
    setIsRunning(false);
    setSubmitting(true);

    const idToTrack = isNA ? "N/A" : isMulti ? "MULTI" : rideId.trim().toUpperCase();
    try {
      await logTimeUpdate(logId, {
        endTime: serverTimestamp(),
        rideId: idToTrack,
        mode: isNA ? "N/A" : isMulti ? "MULTI" : "RIDE",
      });
      setSnack({ open: true, message: "✅ Time logged", severity: "success" });
      localStorage.removeItem("lrp_timeTrack");
      setRideId("");
      setIsNA(false);
      setIsMulti(false);
      setElapsed(0);
      setLogId(null);
      bcRef.current?.postMessage({
        type: "timeclock:ended",
        driver,
        payload: { endTime: end.toMillis() },
      });
    } catch (err) {
      setSnack({ open: true, message: `❌ Failed: ${err.message}`, severity: "error" });
      setIsRunning(true);
    }

    setSubmitting(false);
  };

  const columns = [
    { field: "rideId", headerName: "Ride ID", flex: 1 },
    {
      field: "startTime",
      headerName: "Start Time",
      flex: 1.5,
      valueGetter: (params) =>
        params.value ? dayjs(params.value).format("MM/DD hh:mm A") : "",
    },
    {
      field: "endTime",
      headerName: "End Time",
      flex: 1.5,
      valueGetter: (params) =>
        params.value ? dayjs(params.value).format("MM/DD hh:mm A") : "",
    },
    {
      field: "duration",
      headerName: "Duration",
      flex: 1,
      valueGetter: (params) => `${params.row.duration || 0}m`,
    },
  ];

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
            setIsNA(e.target.checked); if (e.target.checked) setIsMulti(false);
          }} disabled={isRunning} />}
          label="N/A – Non-Ride Task"
        />
        <FormControlLabel
          control={<Checkbox checked={isMulti} onChange={(e) => {
            setIsMulti(e.target.checked); if (e.target.checked) setIsNA(false);
          }} disabled={isRunning} />}
          label="Multiple Back-to-Back Rides"
        />
        <Stack direction="row" spacing={2} mt={2}>
          <Button fullWidth onClick={handleStart} disabled={isRunning || submitting}
            startIcon={<PlayArrowIcon />} variant="contained" color="success">
            {submitting && !isRunning ? "Starting…" : "Start"}
          </Button>
          <Button fullWidth onClick={handleEnd} disabled={!isRunning || submitting}
            startIcon={<StopIcon />} variant="contained" color="error">
            {submitting && isRunning ? "Logging…" : "End"}
          </Button>
        </Stack>
        {isRunning && (
          <Typography mt={2} color="success.main">
            🟢 Started — Elapsed: {formatElapsed(elapsed)}
          </Typography>
        )}
        {!isRunning && endTime && (
          <Typography mt={2} color="text.secondary">
            Ended at {dayjs(endTime.toDate()).format("HH:mm")}
          </Typography>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1">Previous Sessions</Typography>
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
