// src/components/TimeClockGodMode.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import { GridToolbar } from "@mui/x-data-grid-pro";
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import {
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
  Timestamp,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

import { dayjs } from "@/utils/time";
import { db } from "src/utils/firebaseInit";
import { useRole } from "@/hooks";
import RoleDebug from "@/components/RoleDebug";

import { useAuth } from "../context/AuthContext.jsx";
import { mapSnapshotToRows, enrichDriverNames } from "../services/normalizers";
import { getChannel, safePost, closeChannel } from "../utils/broadcast";
import logError from "../utils/logError.js";
import { tsToDate } from "../utils/safe";
import { waitForAuth } from "../utils/waitForAuth";

import ResponsiveScrollBox from "./datagrid/ResponsiveScrollBox.jsx";
import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import {
  formatTs,
  minutesToHuman,
  diffMinutes,
  DEFAULT_TZ,
} from "./datagrid/selectionV8.js";
import ErrorBanner from "./ErrorBanner";
import PageContainer from "./PageContainer.jsx";

const bcName = "lrp-timeclock";

async function logTimeCreate(payload) {
  const user = await waitForAuth(true);
  const userEmail = (user.email || "").toLowerCase();

  return addDoc(collection(db, "timeLogs"), {
    userEmail,
    driverEmail: userEmail,
    driverId: payload.driverId ?? null,
    startTime:
      payload.startTime instanceof Timestamp
        ? payload.startTime
        : serverTimestamp(),
    endTime: payload.endTime ?? null,
    rideId: payload.rideId ?? null,
    mode: payload.mode ?? "N/A",
    loggedAt: serverTimestamp(),
  });
}

async function logTimeUpdate(id, patch) {
  await waitForAuth(true);
  return updateDoc(doc(db, "timeLogs", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

function tsToMillis(v) {
  const d = tsToDate(v);
  return d ? d.getTime() : null;
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
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [submitting, setSubmitting] = useState(false);
  const [logId, setLogId] = useState(null);
  const driverRef = useRef(driver);
  const isRunningRef = useRef(isRunning);

  const { role, authLoading: roleLoading } = useRole();
  const { user } = useAuth();
  const isAdmin = role === "admin";
  const isDriver = role === "driver";
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const columns = useMemo(
    () => [
      {
        field: "id",
        headerName: "Id",
        minWidth: 90,
        flex: 0.6,
        valueGetter: (p) => p?.row?.id ?? "N/A",
      },
      {
        field: "driver",
        headerName: "Driver",
        minWidth: 160,
        flex: 1,
        valueGetter: (p) => p?.row?.driver ?? "N/A",
      },
      {
        field: "rideId",
        headerName: "Ride Id",
        minWidth: 120,
        flex: 0.8,
        valueGetter: (p) => p?.row?.rideId ?? "N/A",
      },
      {
        field: "startTime",
        headerName: "Start Time",
        minWidth: 170,
        flex: 1,
        valueGetter: (p) =>
          formatTs(p?.row?.startTime, "MMM D, h:mm a", DEFAULT_TZ),
      },
      {
        field: "endTime",
        headerName: "End Time",
        minWidth: 170,
        flex: 1,
        valueGetter: (p) =>
          formatTs(p?.row?.endTime, "MMM D, h:mm a", DEFAULT_TZ),
      },
      {
        field: "duration",
        headerName: "Duration",
        minWidth: 130,
        flex: 0.7,
        valueGetter: (p) => {
          const minutes =
            typeof p?.row?.duration === "number"
              ? p.row.duration
              : diffMinutes(p?.row?.startTime, p?.row?.endTime, DEFAULT_TZ);
          return minutesToHuman(minutes);
        },
      },
      {
        field: "updatedAt",
        headerName: "Updated At",
        minWidth: 170,
        flex: 1,
        valueGetter: (p) =>
          formatTs(p?.row?.updatedAt, "MMM D, h:mm a", DEFAULT_TZ),
      },
    ],
    [],
  );

  const getRowId = useCallback(
    (r) => r?.id ?? r?.docId ?? r?._id ?? JSON.stringify(r),
    [],
  );

  useEffect(() => {
    if (!user?.email) return;
    setReady(false);
    const q = query(
      collection(db, "timeLogs"),
      where("userEmail", "==", user.email.toLowerCase()),
      orderBy("startTime", "desc"),
      limit(200),
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const base = mapSnapshotToRows("timeLogs", snap);
        const withNames = await enrichDriverNames(base);
        setRows(withNames);
        setReady(true);
      },
      (err) => {
        logError(err, { area: "subscribeMyTimeLogs", comp: "TimeClock" });
        setError(err);
        setReady(true);
      },
    );
    return () => unsub();
  }, [user?.email]);

  // logs are populated via Firestore subscription

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
    const c = getChannel(bcName);
    if (c) {
      c.onmessage = (e) => {
        if (
          e?.data?.type === "timeclock:started" &&
          e.data.driver === driverRef.current
        ) {
          if (!isRunningRef.current) {
            const s = e.data.payload;
            setRideId(s.rideId || "");
            setStartTime(Timestamp.fromMillis(s.startTime));
            setIsNA(s.isNA);
            setIsMulti(s.isMulti);
            setIsRunning(true);
          }
        }
        if (
          e?.data?.type === "timeclock:ended" &&
          e.data.driver === driverRef.current
        ) {
          setIsRunning(false);
          setEndTime(Timestamp.fromMillis(e.data.payload.endTime));
          localStorage.removeItem("lrp_timeTrack");
        }
      };
    }
    return () => closeChannel();
  }, []);

  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    setIsTracking(isRunning);
  }, [isRunning, setIsTracking]);

  useEffect(() => {
    if (!isRunning || !startTime) return;
    const timer = setInterval(() => {
      setElapsed(
        Math.floor(
          (tsToMillis(Timestamp.now()) - tsToMillis(startTime)) / 1000,
        ),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, startTime]);

  // subscription handled by useFirestoreSub above

  const formatElapsed = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const handleStart = async () => {
    if (!driver || (!rideId && !isNA && !isMulti)) {
      return setSnack({
        open: true,
        message: "Enter Ride ID or select a mode",
        severity: "error",
      });
    }
    if (isRunning) return;

    const now = Timestamp.now();
    const idToTrack = isNA
      ? "N/A"
      : isMulti
        ? "MULTI"
        : rideId.trim().toUpperCase();
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
          startTime: tsToMillis(now),
          logId: ref.id,
        }),
      );
      safePost(
        {
          type: "timeclock:started",
          driver,
          payload: {
            rideId: idToTrack,
            isNA,
            isMulti,
            startTime: tsToMillis(now),
            logId: ref.id,
          },
        },
        bcName,
      );
    } catch (e) {
      logError(e, { area: "FirestoreSubscribe", comp: "TimeClock" });
      setSnack({
        open: true,
        message: `❌ Failed: ${e.message}`,
        severity: "error",
      });
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

    const idToTrack = isNA
      ? "N/A"
      : isMulti
        ? "MULTI"
        : rideId.trim().toUpperCase();
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
      safePost(
        {
          type: "timeclock:ended",
          driver,
          payload: { endTime: tsToMillis(end) },
        },
        bcName,
      );
    } catch (err) {
      setSnack({
        open: true,
        message: `❌ Failed: ${err.message}`,
        severity: "error",
      });
      setIsRunning(true);
    }

    setSubmitting(false);
  };

  if (roleLoading) return <CircularProgress sx={{ m: 3 }} />;
  if (!(isAdmin || isDriver))
    return (
      <Alert severity="error">You don’t have permission to view this.</Alert>
    );
  if (!ready) return <CircularProgress sx={{ mt: 2 }} />;

  return (
    <PageContainer maxWidth={600}>
      {import.meta.env.DEV && <RoleDebug />}
      <ErrorBanner error={error} />
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Time Clock
        </Typography>
        <TextField
          label="Ride ID"
          fullWidth
          disabled={isRunning || isNA || isMulti}
          value={rideId}
          onChange={(e) => setRideId(e.target.value.trimStart())}
          helperText="Enter Ride ID or select a task type"
        />
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
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mt={2}>
          <Button
            onClick={handleStart}
            disabled={isRunning || submitting}
            startIcon={<PlayArrowIcon />}
            variant="contained"
            color="success"
            sx={{ flex: 1 }}
          >
            {submitting && !isRunning ? "Starting…" : "Start"}
          </Button>
          <Button
            onClick={handleEnd}
            disabled={!isRunning || submitting}
            startIcon={<StopIcon />}
            variant="contained"
            color="error"
            sx={{ flex: 1 }}
          >
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
            Ended at {dayjs(tsToMillis(endTime)).format("HH:mm")}
          </Typography>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={1}
        >
          <Typography variant="subtitle1">Previous Sessions</Typography>
        </Box>
        <ResponsiveScrollBox>
          <SmartAutoGrid
            rows={rows}
            columns={columns}
            getRowId={getRowId}
            autoHeight
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 500 },
              },
            }}
          />
        </ResponsiveScrollBox>
        {rows.length === 0 && (
          <Typography textAlign="center" color="text.secondary" mt={2}>
            No time logs found.
          </Typography>
        )}
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack({ ...snack, open: false })}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}
