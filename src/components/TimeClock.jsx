// src/components/TimeClockGodMode.jsx
import { useState, useEffect, useRef, useMemo } from "react";
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
  useTheme,
  useMediaQuery,
  keyframes,
} from "@mui/material";
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
import { friendlyTzLabel } from "@/utils/timeSafe";

import { useAuth } from "../context/AuthContext.jsx";
import { enrichDriverNames } from "../services/normalizers";
import { getChannel, safePost, closeChannel } from "../utils/broadcast";
import logError from "../utils/logError.js";
import { tsToDate } from "../utils/safe";
import { waitForAuth } from "../utils/waitForAuth";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import {
  LoadingOverlay,
  NoRowsOverlay,
  ErrorOverlay,
} from "./grid/overlays.jsx";
import ErrorBanner from "./ErrorBanner";
import PageContainer from "./PageContainer.jsx";

const bcName = "lrp-timeclock";

const tzLabel = friendlyTzLabel();

function normalizeRow(r) {
  const id =
    r?.id ??
    r?.docId ??
    r?._id ??
    `${r?.userEmail || "unknown"}-${(r?.startTime && r.startTime.seconds) || r?.startTime || Math.random()}`;
  const driverName =
    r?.driver ??
    r?.driverName ??
    r?.name ??
    (typeof r?.driverEmail === "string" ? r.driverEmail.split("@")[0] : null) ??
    (typeof r?.userEmail === "string" ? r.userEmail.split("@")[0] : null);
  const start = r?.startTime ?? r?.clockIn ?? r?.inTime ?? null;
  const end = r?.endTime ?? r?.clockOut ?? r?.outTime ?? null;
  const updatedAt = r?.updatedAt ?? r?.loggedAt ?? r?._updatedAt ?? null;
  return {
    ...r,
    id,
    driver: driverName || null,
    rideId: r?.rideId ?? r?.ride ?? r?.mode ?? null,
    startTime: start,
    endTime: end,
    updatedAt,
    duration: typeof r?.duration === "number" ? r.duration : null,
  };
}
const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.03); opacity: 0.9; }
  100% { transform: scale(1); opacity: 1; }
`;

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
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const [undo, setUndo] = useState(null); // { id, prevEnd }
  const [startingAnim, setStartingAnim] = useState(false);
  const [endingAnim, setEndingAnim] = useState(false);

  const headerMap = useMemo(
    () => ({
      driver: "Driver",
      userEmail: "Driver Email",
      rideId: "Ride ID",
      startTime: "Clock In",
      endTime: "Clock Out",
      duration: "Duration",
      loggedAt: "Logged At",
      note: "Note",
    }),
    [],
  );

  const order = useMemo(
    () => [
      "driver",
      "userEmail",
      "rideId",
      "startTime",
      "endTime",
      "duration",
      "loggedAt",
      "note",
    ],
    [],
  );

  const forceHide = useMemo(() => ["id", "driverId", "mode"], []);

  useEffect(() => {
    if (!user?.email) {
      setRows([]);
      setReady(true);
      return;
    }
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
        const base = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const withNames = await enrichDriverNames(base);
        const normalized = withNames.map(normalizeRow);
        setRows(normalized);
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
    setStartingAnim(true);
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
      setTimeout(() => setStartingAnim(false), 420);
    }
  };

  const handleEnd = async () => {
    if (!isRunning || !startTime || !logId) return;

    const end = Timestamp.now();
    setEndTime(end);
    setIsRunning(false);
    setSubmitting(true);
    setEndingAnim(true);

    const idToTrack = isNA
      ? "N/A"
      : isMulti
        ? "MULTI"
        : rideId.trim().toUpperCase();
    try {
      const prevEnd = null;
      await logTimeUpdate(logId, {
        endTime: serverTimestamp(),
        rideId: idToTrack,
        mode: isNA ? "N/A" : isMulti ? "MULTI" : "RIDE",
      });
      setUndo({
        id: logId,
        prevEnd,
        rideId: idToTrack,
        isNA,
        isMulti,
        startTime,
      });
      setSnack({
        open: true,
        message: "Session ended. Undo?",
        severity: "info",
      });
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
    setTimeout(() => setEndingAnim(false), 420);
  };

  if (roleLoading) return <CircularProgress sx={{ m: 3 }} />;
  if (!(isAdmin || isDriver))
    return (
      <Alert severity="error">You don’t have permission to view this.</Alert>
    );

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
            sx={{
              flex: 1,
              animation: startingAnim ? `${pulse} 400ms ease-in-out` : "none",
              transition: "transform 120ms ease",
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            {submitting && !isRunning ? "Starting…" : "Start"}
          </Button>
          <Button
            onClick={handleEnd}
            disabled={!isRunning || submitting}
            startIcon={<StopIcon />}
            variant="contained"
            color="error"
            sx={{
              flex: 1,
              animation: endingAnim ? `${pulse} 400ms ease-in-out` : "none",
              transition: "transform 120ms ease, background 120ms ease",
              "&:active": { transform: "scale(0.98)" },
            }}
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
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            bgcolor: "background.paper",
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle1">Previous Sessions</Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontStyle: "italic" }}
          >
            {tzLabel}
          </Typography>
        </Box>
        <Paper sx={{ width: "100%" }}>
          <SmartAutoGrid
            rows={rows || []}
            headerMap={headerMap}
            order={order}
            forceHide={forceHide}
            autoHeight={false}
            checkboxSelection={false}
            disableRowSelectionOnClick
            sx={{ width: "100%", maxWidth: "100%" }}
            slots={{
              loadingOverlay: LoadingOverlay,
              noRowsOverlay: NoRowsOverlay,
              errorOverlay: ErrorOverlay,
            }}
            loading={!ready}
            error={error}
            density={isXs ? "compact" : "standard"}
          />
        </Paper>
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
          action={
            undo?.id ? (
              <Button
                size="small"
                color="inherit"
                onClick={async () => {
                  try {
                    await logTimeUpdate(undo.id, { endTime: null });
                    setLogId(undo.id);
                    setEndTime(null);
                    setIsRunning(true);
                    setRideId(
                      undo.isNA || undo.isMulti ? "" : undo.rideId || "",
                    );
                    setIsNA(!!undo.isNA);
                    setIsMulti(!!undo.isMulti);
                    setStartTime(undo.startTime);
                    setElapsed(
                      Math.floor(
                        (tsToMillis(Timestamp.now()) -
                          tsToMillis(undo.startTime)) /
                          1000,
                      ),
                    );
                    localStorage.setItem(
                      "lrp_timeTrack",
                      JSON.stringify({
                        driver,
                        rideId: undo.rideId,
                        isNA: undo.isNA,
                        isMulti: undo.isMulti,
                        startTime: tsToMillis(undo.startTime),
                        logId: undo.id,
                      }),
                    );
                    safePost(
                      {
                        type: "timeclock:started",
                        driver,
                        payload: {
                          rideId: undo.rideId,
                          isNA: undo.isNA,
                          isMulti: undo.isMulti,
                          startTime: tsToMillis(undo.startTime),
                          logId: undo.id,
                        },
                      },
                      bcName,
                    );
                    setSnack({
                      open: true,
                      message: "Clock-out undone",
                      severity: "success",
                    });
                  } catch (e) {
                    logError(e, { area: "timeclock-undo" });
                    setSnack({
                      open: true,
                      message: "Undo failed",
                      severity: "error",
                    });
                  } finally {
                    setUndo(null);
                  }
                }}
              >
                UNDO
              </Button>
            ) : null
          }
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}
