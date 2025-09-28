// src/components/TimeClock.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  InfoOutlined,
  PlayArrow,
  Stop,
  Undo as UndoIcon,
} from "@mui/icons-material";

import { dayjs, formatDateTime, safeDuration } from "@/utils/time";
import logError from "@/utils/logError";
import {
  subscribeMyTimeLogs,
  startTimeLog,
  endTimeLog,
  patchTimeLog,
} from "@/services/timeLogs";
import { useAuth } from "@/context/AuthContext.jsx";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import { buildTimeLogColumns } from "@/components/datagrid/columns/timeLogColumns.shared.js";

function buildCheckboxLabel(text, helper) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" component="span">
      <Typography component="span" variant="body2">
        {text}
      </Typography>
      <Tooltip title={helper} placement="top">
        <IconButton size="small" sx={{ p: 0.25, color: "inherit" }}>
          <InfoOutlined fontSize="inherit" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

export default function TimeClock({ setIsTracking }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user, role, roleLoading } = useAuth();
  const isAdmin = role === "admin";
  const isDriver = role === "driver";

  const [rideId, setRideId] = useState("");
  const [nonRideTask, setNonRideTask] = useState(false);
  const [multiRide, setMultiRide] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarError, setSnackbarError] = useState(null);
  const [lastEndedSessionRef, setLastEndedSessionRef] = useState(null);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({});
  const [activeSession, setActiveSession] = useState(null);
  const [, setDurationTick] = useState(0);

  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const baseModel = isMobile
      ? { driverEmail: false, rideId: false, endTime: false }
      : {};
    setColumnVisibilityModel(baseModel);
  }, [isMobile]);

  const normalizeRow = useCallback(
    (row) => {
      if (!row) return null;
      const emailRaw = row.driverEmail || row.userEmail || "";
      const email =
        typeof emailRaw === "string" ? emailRaw.toLowerCase() : emailRaw;
      const fallbackEmail = typeof emailRaw === "string" ? emailRaw : "";
      const displayNameMatch =
        user?.email && email ? email === user.email.toLowerCase() : false;
      const fallbackName = fallbackEmail.includes("@")
        ? fallbackEmail.split("@")[0]
        : fallbackEmail;

      return {
        ...row,
        id:
          row.id ||
          row.docId ||
          row._id ||
          `${fallbackEmail || "unknown"}-${
            row?.startTime?.seconds ?? row?.startTime ?? "start"
          }`,
        driverEmail: fallbackEmail || "N/A",
        driverName:
          row.driverName ||
          row.driver ||
          (displayNameMatch ? user?.displayName : null) ||
          fallbackName ||
          "N/A",
      };
    },
    [user?.displayName, user?.email],
  );

  useEffect(() => {
    if (!user) {
      setRows([]);
      setActiveSession(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeMyTimeLogs({
      user,
      onData: (data) => {
        if (!mountedRef.current) return;
        const normalized = (data || [])
          .map((row) => normalizeRow(row))
          .filter(Boolean);
        setRows(normalized);
        const active =
          normalized.find((row) => row && row.endTime == null) || null;
        setActiveSession(active);
        setLoadError(null);
        setLoading(false);
      },
      onError: (error) => {
        if (!mountedRef.current) return;
        logError(error, { where: "TimeClock.subscribeMyTimeLogs" });
        setLoadError(error);
        setLoading(false);
      },
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [normalizeRow, user]);

  useEffect(() => {
    if (typeof setIsTracking === "function") {
      setIsTracking(Boolean(activeSession));
    }
  }, [activeSession, setIsTracking]);

  useEffect(() => {
    setDurationTick(0);
    if (!activeSession) {
      if (!isStarting) {
        setRideId("");
        setNonRideTask(false);
        setMultiRide(false);
      }
      return;
    }

    const modeValue = activeSession.mode || "RIDE";
    setNonRideTask(modeValue === "N/A");
    setMultiRide(modeValue === "MULTI");
    if (modeValue === "RIDE") {
      setRideId(activeSession.rideId || "");
    } else {
      setRideId("");
    }
  }, [activeSession, isStarting]);

  useEffect(() => {
    if (!activeSession || activeSession.endTime) return undefined;
    const timer = setInterval(() => {
      setDurationTick((tick) => tick + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const columns = useMemo(() => buildTimeLogColumns(), []);

  const gridRows = useMemo(() => rows, [rows]);

  const activeStart = useMemo(() => {
    if (!activeSession?.startTime) return null;
    return formatDateTime(activeSession.startTime, "MMM D, h:mm A");
  }, [activeSession?.startTime]);

  const activeDurationText = activeSession?.startTime
    ? safeDuration(activeSession.startTime, activeSession.endTime ?? null)
    : "N/A";

  const tzLabel = useMemo(() => {
    try {
      const guess = dayjs.tz?.guess?.() || "UTC";
      const base = dayjs().tz ? dayjs().tz(guess) : dayjs();
      return base.format("zz");
    } catch (error) {
      logError(error, { where: "TimeClock.tzLabel" });
      return dayjs.tz?.guess?.() || "UTC";
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!user) {
      setSnackbarError("You must be signed in to start a session.");
      return;
    }
    if (!nonRideTask && !multiRide && !rideId.trim()) {
      setSnackbarError("Enter Ride ID or choose a task type.");
      return;
    }
    if (isStarting || isEnding || activeSession) return;

    const normalizedRideId = rideId.trim().toUpperCase();
    const mode = nonRideTask ? "N/A" : multiRide ? "MULTI" : "RIDE";

    setIsStarting(true);
    setSnackbarError(null);

    try {
      await startTimeLog({
        user,
        rideId: mode === "RIDE" ? normalizedRideId : null,
        mode,
      });
    } catch (error) {
      logError(error, {
        where: "TimeClock.startTimeLog",
        rideId: normalizedRideId || mode,
      });
      setSnackbarError("Failed to start session. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }, [
    activeSession,
    isEnding,
    isStarting,
    multiRide,
    nonRideTask,
    rideId,
    user,
  ]);

  const handleEnd = useCallback(async () => {
    if (!activeSession || isEnding || isStarting) return;

    const mode = nonRideTask ? "N/A" : multiRide ? "MULTI" : "RIDE";
    const normalizedRideId =
      mode === "RIDE"
        ? (rideId || activeSession.rideId || "").trim().toUpperCase()
        : null;

    setIsEnding(true);
    setSnackbarError(null);
    setLastEndedSessionRef({
      id: activeSession.id,
      previousEndTime: activeSession.endTime ?? null,
      rideId: activeSession.rideId ?? null,
    });
    setSnackbarOpen(true);

    try {
      await endTimeLog({
        id: activeSession.id,
        rideId: normalizedRideId,
        mode,
      });
      setRideId("");
      setNonRideTask(false);
      setMultiRide(false);
    } catch (error) {
      logError(error, { where: "TimeClock.endTimeLog", id: activeSession.id });
      setSnackbarOpen(false);
      setLastEndedSessionRef(null);
      setSnackbarError("Failed to end session. Please try again.");
    } finally {
      setIsEnding(false);
    }
  }, [activeSession, isEnding, isStarting, multiRide, nonRideTask, rideId]);

  const handleUndo = useCallback(async () => {
    if (!lastEndedSessionRef) return;
    try {
      await patchTimeLog(lastEndedSessionRef.id, {
        endTime: lastEndedSessionRef.previousEndTime ?? null,
        rideId: lastEndedSessionRef.rideId ?? null,
      });
      setSnackbarOpen(false);
      setLastEndedSessionRef(null);
    } catch (error) {
      logError(error, {
        where: "TimeClock.undo",
        id: lastEndedSessionRef.id,
      });
      setSnackbarError("Undo failed. Session remains ended.");
    }
  }, [lastEndedSessionRef]);

  const handleSnackbarClose = useCallback(() => {
    setSnackbarOpen(false);
    setLastEndedSessionRef(null);
  }, []);

  const gridSlots = useMemo(
    () => ({
      noRowsOverlay: () => (
        <Stack sx={{ p: 3 }} alignItems="center" justifyContent="center">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No previous sessions found. Start your first one above 👆.
          </Typography>
        </Stack>
      ),
      errorOverlay: () => (
        <Alert severity="error">Couldn’t load sessions. Try again.</Alert>
      ),
    }),
    [],
  );

  const dataGridStyles = useMemo(
    () => ({
      borderRadius: 3,
      backgroundColor: theme.palette.mode === "dark" ? "#0b0b0b" : "#ffffff",
      "& .MuiDataGrid-columnHeaders": {
        borderBottom: "1px solid #4cbb17",
      },
      "& .MuiDataGrid-row:hover": {
        opacity: 0.95,
      },
    }),
    [theme.palette.mode],
  );

  const gridSlotProps = useMemo(
    () => ({
      toolbar: {
        showQuickFilter: true,
        quickFilterProps: {
          debounceMs: 300,
          placeholder: "Search sessions",
        },
      },
    }),
    [],
  );

  if (roleLoading) {
    return (
      <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!(isAdmin || isDriver)) {
    return (
      <Stack spacing={2} sx={{ py: 3 }}>
        <Alert severity="error">You don’t have permission to view this.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Card sx={{ backgroundColor: theme.palette.background.paper }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={2}>
            <Typography variant="h6">Time Clock</Typography>
            {activeSession ? (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Active since {activeStart || "N/A"}
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  Duration: {activeDurationText}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Start a session to begin tracking your time.
              </Typography>
            )}
            <TextField
              fullWidth
              size="medium"
              placeholder="Ride ID"
              value={rideId}
              disabled={Boolean(activeSession) || nonRideTask || multiRide}
              onChange={(event) => setRideId(event.target.value)}
              helperText="Enter Ride ID or choose a task type below"
              FormHelperTextProps={{
                sx: { color: theme.palette.text.secondary },
              }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={nonRideTask}
                    onChange={(event) => {
                      setNonRideTask(event.target.checked);
                      if (event.target.checked) setMultiRide(false);
                    }}
                    disabled={Boolean(activeSession)}
                  />
                }
                label={buildCheckboxLabel(
                  "N/A — Non-Ride Task",
                  "Use for administrative or support work that isn’t tied to a ride.",
                )}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={multiRide}
                    onChange={(event) => {
                      setMultiRide(event.target.checked);
                      if (event.target.checked) setNonRideTask(false);
                    }}
                    disabled={Boolean(activeSession)}
                  />
                }
                label={buildCheckboxLabel(
                  "Multiple Back-to-Back Rides",
                  "Track consecutive rides without logging a specific ride ID.",
                )}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                color="success"
                startIcon={
                  isStarting ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <PlayArrow />
                  )
                }
                disabled={Boolean(activeSession) || isStarting || isEnding}
                onClick={handleStart}
              >
                {isStarting ? "Starting…" : "Start Session"}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={
                  isEnding ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <Stop />
                  )
                }
                disabled={!activeSession || isEnding || isStarting}
                onClick={handleEnd}
              >
                {isEnding ? "Ending…" : "End Session"}
              </Button>
            </Stack>
            {snackbarError && (
              <Alert
                severity="error"
                onClose={() => setSnackbarError(null)}
                sx={{ mt: 1 }}
              >
                {snackbarError}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Divider sx={{ my: 1 }} />

      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          backdropFilter: "blur(4px)",
          backgroundColor: "rgba(0,0,0,0.4)",
          px: 1,
          py: 0.5,
          borderRadius: 1,
        }}
      >
        <Typography variant="h6">Previous Sessions</Typography>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          {tzLabel} (Central Time if applicable)
        </Typography>
      </Stack>

      {loadError && (
        <Alert severity="warning">
          Failed to load some sessions. Showing cached data.
        </Alert>
      )}

      <Box sx={{ width: "100%" }}>
        <LrpGrid
          rows={gridRows}
          columns={columns}
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          autoHeight={isMobile}
          loading={loading}
          error={Boolean(loadError)}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={(model) =>
            setColumnVisibilityModel(model)
          }
          slots={gridSlots}
          slotProps={gridSlotProps}
          sx={dataGridStyles}
        />
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message="Session ended — Undo?"
        action={
          lastEndedSessionRef ? (
            <Button
              color="inherit"
              size="small"
              startIcon={<UndoIcon />}
              onClick={handleUndo}
            >
              Undo
            </Button>
          ) : null
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}
