// src/components/TimeClock.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  keyframes,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Undo as UndoIcon,
} from "@mui/icons-material";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { dayjs } from "@/utils/time";
import { db } from "src/utils/firebaseInit";
import { friendlyTzLabel } from "@/utils/timeSafe";
import { useRole } from "@/hooks";
import RoleDebug from "@/components/RoleDebug";

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
const TZ = "America/Chicago";

const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.03); opacity: 0.9; }
  100% { transform: scale(1); opacity: 1; }
`;

function toDayjsTz(ts) {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return dayjs(ts.toDate()).tz(TZ);
    if (typeof ts?.seconds === "number")
      return dayjs(new Date(ts.seconds * 1000)).tz(TZ);
    return dayjs(ts).tz(TZ);
  } catch {
    return null;
  }
}

function formatTimestamp(ts) {
  const d = toDayjsTz(ts);
  return d ? d.format("MMM D, h:mm A") : "N/A";
}

function formatDuration(startTs, endTs) {
  const s = toDayjsTz(startTs);
  const e = toDayjsTz(endTs || Timestamp.now());
  if (!s || !e) return "N/A";
  const mins = e.diff(s, "minute");
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

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
  const durationMin =
    start && end
      ? Math.round((tsToMillis(end) - tsToMillis(start)) / 60000)
      : null;
  return {
    ...r,
    id,
    driver: driverName || null,
    rideId: r?.rideId ?? r?.ride ?? r?.mode ?? null,
    startTime: start,
    endTime: end,
    updatedAt,
    duration: durationMin,
  };
}

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

export default function TimeClock({ driver, setIsTracking }) {
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
  const [logId, setLogId] = useState(null);
  const [undo, setUndo] = useState(null); // { id, prevEnd }
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  const driverRef = useRef(driver);
  const isRunningRef = useRef(isRunning);

  const { role, authLoading: roleLoading } = useRole();
  const { user } = useAuth();
  const isAdmin = role === "admin";
  const isDriver = role === "driver";
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));

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

  const overrides = useMemo(
    () => ({
      startTime: { valueGetter: (v, row) => formatTimestamp(row.startTime) },
      endTime: { valueGetter: (v, row) => formatTimestamp(row.endTime) },
      duration: {
        valueGetter: (v, row) => formatDuration(row.startTime, row.endTime),
        sortComparator: (v1, v2, p1, p2) => {
          const d1 = p1?.row?.duration ?? 0;
          const d2 = p2?.row?.duration ?? 0;
          return d1 - d2;
        },
      },
    }),
    [],
  );

  const columnVisibilityModel = useMemo(
    () => (isXs ? { userEmail: false, loggedAt: false, note: false } : {}),
    [isXs],
  );

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
        try {
          const base = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const withNames = await enrichDriverNames(base);
          const normalized = withNames.map(normalizeRow);
          setRows(normalized);
          setReady(true);
        } catch (err) {
          logError(err, { area: "processTimeLogs", comp: "TimeClock" });
          setError(err);
          setReady(true);
        }
      },
      (err) => {
        logError(err, { area: "subscribeMyTimeLogs", comp: "TimeClock" });
        setError(err);
        setReady(true);
      },
    );
    return () => unsub();
  }, [user?.email]);

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

  const formatElapsed = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }, []);

  const handleStart = useCallback(async () => {
    if (!driver || (!rideId && !isNA && !isMulti)) {
      return setSnack({
        open: true,
        message: "Enter Ride ID or select a mode",
        severity: "error",
      });
    }
    if (isRunning || starting || ending) return;

    const now = Timestamp.now();
    const idToTrack = isNA
      ? "N/A"
      : isMulti
        ? "MULTI"
        : rideId.trim().toUpperCase();
    setStarting(true);
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
      logError(e, { area: "startSession", comp: "TimeClock" });
      setSnack({
        open: true,
        message: `❌ Failed: ${e.message}`,
        severity: "error",
      });
    } finally {
      setStarting(false);
    }
  }, [driver, rideId, isNA, isMulti, isRunning, starting, ending]);

  const handleEnd = useCallback(async () => {
    if (!isRunning || !startTime || !logId || starting || ending) return;

    const end = Timestamp.now();
    setEndTime(end);
    setIsRunning(false);
    setEnding(true);

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
      setSnack({ open: true, message: "Session ended", severity: "info" });
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
    } finally {
      setEnding(false);
    }
  }, [
    isRunning,
    startTime,
    logId,
    isNA,
    isMulti,
    rideId,
    driver,
    starting,
    ending,
  ]);

  if (roleLoading) return <CircularProgress sx={{ m: 3 }} />;
  if (!(isAdmin || isDriver))
    return (
      <Alert severity="error">You don’t have permission to view this.</Alert>
    );

  return (
    <PageContainer maxWidth={600}>
      {import.meta.env.DEV && <RoleDebug />}
      <ErrorBanner error={error} />
      <Paper elevation={3} sx={{ p: 3, mb: 3, width: "100%" }}>
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
            disabled={isRunning || starting || ending}
            startIcon={<PlayArrowIcon />}
            variant="contained"
            color="success"
            sx={{
              flex: 1,
              animation: starting ? `${pulse} 400ms ease-in-out` : "none",
              transition: "transform 120ms ease",
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            {starting ? "Starting…" : "Start"}
          </Button>
          <Button
            onClick={handleEnd}
            disabled={!isRunning || starting || ending}
            startIcon={<StopIcon />}
            variant="contained"
            color="error"
            sx={{
              flex: 1,
              animation: ending ? `${pulse} 400ms ease-in-out` : "none",
              transition: "transform 120ms ease, background 120ms ease",
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            {ending ? "Logging…" : "End"}
          </Button>
        </Stack>
        {isRunning && (
          <Typography mt={2} color="success.main">
            🟢 Started — Elapsed: {formatElapsed(elapsed)}
          </Typography>
        )}
        {!isRunning && endTime && (
          <Typography mt={2} color="text.secondary">
            Ended at {formatTimestamp(endTime)}
          </Typography>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: 2, width: "100%" }}>
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
            variant="body2"
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
            overrides={overrides}
            autoHeight={false}
            checkboxSelection
            disableRowSelectionOnClick
            columnVisibilityModel={columnVisibilityModel}
            sx={{ width: "100%", maxWidth: "100%", height: 520 }}
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
        onClose={() => {
          setSnack({ ...snack, open: false });
          setUndo(null);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => {
            setSnack({ ...snack, open: false });
            setUndo(null);
          }}
          action={
            undo?.id ? (
              <Button
                size="small"
                color="inherit"
                startIcon={<UndoIcon fontSize="small" />}
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
                Undo
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
