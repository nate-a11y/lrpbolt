// src/components/TimeClock.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
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
import { Timestamp } from "firebase/firestore";
import dayjs from "dayjs";

import { toDayjs, formatDuration } from "@/utils/time";
import logError from "@/utils/logError";
import { subscribeTimeLogs, logTime, endSession } from "@/services/timeLogs";
import { enrichDriverNames } from "@/services/normalizers";
import { useAuth } from "@/context/AuthContext.jsx";
import { useRole } from "@/hooks";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";

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

export default function TimeClock({ driver, setIsTracking }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();
  const { role, authLoading: roleLoading } = useRole();
  const isAdmin = role === "admin";
  const isDriver = role === "driver";

  const [rideId, setRideId] = useState("");
  const [nonRideTask, setNonRideTask] = useState(false);
  const [multiRide, setMultiRide] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarError, setSnackbarError] = useState(null);
  const [lastEndedSessionRef, setLastEndedSessionRef] = useState(null);
  const [driverFilter, setDriverFilter] = useState(null);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({});
  const [, setLiveTick] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const baseModel = isMobile ? { rideId: false, clockOut: false } : {};
    setColumnVisibilityModel(baseModel);
  }, [isMobile]);

  const timezoneGuess = useMemo(() => {
    try {
      return dayjs.tz?.guess?.() || "UTC";
    } catch (err) {
      logError(err, { where: "TimeClock.tzGuess" });
      return "UTC";
    }
  }, []);

  const formatClock = useCallback(
    (timestamp, fallback = "N/A") => {
      // Convert timestamps via toDayjs before formatting.
      const parsed = toDayjs(timestamp);
      if (!parsed) return { label: fallback, relative: "" };
      try {
        const localized = parsed.tz?.(timezoneGuess) || parsed;
        return {
          label: localized.format("MMM D, h:mm A"),
          relative: parsed.fromNow?.() || "",
        };
      } catch (err) {
        logError(err, { where: "TimeClock.formatClock" });
        return {
          label: parsed.format("MMM D, h:mm A"),
          relative: parsed.fromNow?.() || "",
        };
      }
    },
    [timezoneGuess],
  );

  useEffect(() => {
    if (!user?.email) {
      setSessions([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeTimeLogs(
      async (rows) => {
        try {
          const enriched = await enrichDriverNames(rows || []);
          if (!mountedRef.current) return;
          setSessions(enriched);
          setLoading(false);
        } catch (err) {
          logError(err, { where: "TimeClock.subscribe.enrich" });
          if (!mountedRef.current) return;
          setLoadError(err);
          setLoading(false);
        }
      },
      (err) => {
        if (!mountedRef.current) return;
        setLoadError(err);
        setLoading(false);
      },
      !isAdmin && user?.email
        ? { driverEmail: user.email, limit: 200 }
        : { limit: 200 },
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [isAdmin, user?.email]);

  const driverOptions = useMemo(() => {
    if (!isAdmin) return [];
    const map = new Map();
    (sessions || []).forEach((row) => {
      const email =
        row?.driverEmail?.toLowerCase?.() || row?.userEmail?.toLowerCase?.();
      if (!email || map.has(email)) return;
      const labelBase =
        row?.driver ||
        row?.driverName ||
        (email.includes("@") ? email.split("@")[0] : email);
      map.set(email, {
        label: labelBase,
        value: email,
        helper: row?.driverEmail || row?.userEmail,
      });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [isAdmin, sessions]);

  const filteredSessions = useMemo(() => {
    if (!isAdmin) return sessions;
    if (!driverFilter?.value) return sessions;
    return (sessions || []).filter((row) => {
      const email =
        row?.driverEmail?.toLowerCase?.() || row?.userEmail?.toLowerCase?.();
      return email === driverFilter.value;
    });
  }, [driverFilter, isAdmin, sessions]);

  const resolveRowId = useCallback((row) => {
    if (!row) return "missing-row";
    return (
      row.id ||
      row.docId ||
      row._id ||
      `${row.driverEmail || row.userEmail || "unknown"}-${
        row.startTime?.seconds ?? row.startTime ?? "start"
      }`
    );
  }, []);

  const gridRows = useMemo(() => {
    return (filteredSessions || []).map((row) => {
      const driverEmail = row?.driverEmail || row?.userEmail || "";
      const driverName =
        row?.driver ||
        row?.driverName ||
        (typeof driverEmail === "string" && driverEmail.includes("@")
          ? driverEmail.split("@")[0]
          : driverEmail) ||
        "Unknown";
      return {
        ...row,
        id: resolveRowId(row),
        driverEmail,
        driverName,
      };
    });
  }, [filteredSessions, resolveRowId]);

  const activeSession = useMemo(() => {
    if (!user?.email) return null;
    const email = user.email.toLowerCase();
    return (
      (sessions || []).find((row) => {
        const rowEmail =
          row?.driverEmail?.toLowerCase?.() || row?.userEmail?.toLowerCase?.();
        const sameDriverId = driver && row?.driverId && row.driverId === driver;
        return !row?.endTime && (rowEmail === email || sameDriverId);
      }) || null
    );
  }, [driver, sessions, user?.email]);

  useEffect(() => {
    if (typeof setIsTracking === "function") {
      setIsTracking(Boolean(activeSession));
    }
  }, [activeSession, setIsTracking]);

  useEffect(() => {
    setLiveTick(0);
    if (!activeSession) {
      if (!isStarting) {
        setRideId("");
        setNonRideTask(false);
        setMultiRide(false);
      }
      return;
    }

    const mode = activeSession?.mode;
    setNonRideTask(mode === "N/A");
    setMultiRide(mode === "MULTI");
    if (mode === "RIDE") {
      setRideId(activeSession?.rideId || "");
    } else {
      setRideId("");
    }
  }, [activeSession, isStarting]);

  useEffect(() => {
    if (!activeSession) return undefined;
    const timer = setInterval(() => {
      setLiveTick((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const activeStart = useMemo(() => {
    return formatClock(activeSession?.startTime).label;
  }, [activeSession?.startTime, formatClock]);

  const activeDurationText = formatDuration(
    activeSession?.startTime,
    activeSession?.endTime,
  );

  const columns = useMemo(
    () => [
      {
        field: "driverName",
        headerName: "Driver",
        minWidth: 140,
        flex: 1,
        valueGetter: (params) => params?.row?.driverName || "N/A",
      },
      {
        field: "rideId",
        headerName: "Ride ID",
        minWidth: 120,
        valueGetter: (params) => {
          const rideId = params?.row?.rideId;
          if (rideId) return rideId;
          const mode = params?.row?.mode;
          if (mode === "N/A") return "Non-Ride Task";
          if (mode === "MULTI") return "Multi Ride";
          return "N/A";
        },
      },
      {
        field: "clockIn",
        headerName: "Clock In",
        minWidth: 160,
        flex: 1,
        valueGetter: (params) => formatClock(params?.row?.startTime).label,
        renderCell: (params) => {
          const { label, relative } = formatClock(params?.row?.startTime);
          if (label === "N/A") return label;
          return (
            <Tooltip title={relative || ""} placement="top">
              <span>{label}</span>
            </Tooltip>
          );
        },
      },
      {
        field: "clockOut",
        headerName: "Clock Out",
        minWidth: 160,
        flex: 1,
        valueGetter: (params) => formatClock(params?.row?.endTime).label,
      },
      {
        field: "duration",
        headerName: "Duration",
        minWidth: 120,
        valueGetter: (params) =>
          formatDuration(params?.row?.startTime, params?.row?.endTime) || "N/A",
      },
    ],
    [formatClock],
  );

  const handleStart = useCallback(async () => {
    if (!user?.email) {
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
      await logTime({
        driverId: driver ?? null,
        driverEmail: user.email,
        rideId: mode === "RIDE" ? normalizedRideId : null,
        mode,
      });
    } catch (err) {
      logError(err, {
        where: "TimeClock.start",
        userId: user?.uid,
        rideId: normalizedRideId || mode,
      });
      setSnackbarError("Failed to start session. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }, [
    activeSession,
    driver,
    isEnding,
    isStarting,
    multiRide,
    nonRideTask,
    rideId,
    user?.email,
    user?.uid,
  ]);

  const handleEnd = useCallback(async () => {
    if (!activeSession || isEnding || isStarting) return;

    const sessionId = resolveRowId(activeSession);
    const previousEndTime = activeSession?.endTime ?? null;
    const optimisticEnd = Timestamp.now();
    const mode = nonRideTask ? "N/A" : multiRide ? "MULTI" : "RIDE";
    const normalizedRideId =
      mode === "RIDE"
        ? (rideId || activeSession?.rideId || "").trim().toUpperCase()
        : null;

    setIsEnding(true);
    setSnackbarError(null);

    setSessions((prev) =>
      prev.map((row) =>
        resolveRowId(row) === sessionId
          ? { ...row, endTime: optimisticEnd, rideId: normalizedRideId }
          : row,
      ),
    );
    setLastEndedSessionRef({
      id: sessionId,
      previousEndTime,
      rideId: activeSession?.rideId ?? null,
      mode: activeSession?.mode ?? null,
    });
    setSnackbarOpen(true);

    try {
      await endSession(sessionId, {
        endTime: optimisticEnd,
        rideId: normalizedRideId,
        mode,
      });
      setRideId("");
      setNonRideTask(false);
      setMultiRide(false);
    } catch (err) {
      logError(err, {
        where: "TimeClock.end",
        userId: user?.uid,
        rideId: normalizedRideId || mode,
      });
      setSessions((prev) =>
        prev.map((row) =>
          resolveRowId(row) === sessionId
            ? {
                ...row,
                endTime: previousEndTime,
                rideId: activeSession?.rideId ?? row.rideId ?? null,
              }
            : row,
        ),
      );
      setSnackbarOpen(false);
      setLastEndedSessionRef(null);
      setSnackbarError("Failed to end session. Please try again.");
    } finally {
      setIsEnding(false);
    }
  }, [
    activeSession,
    multiRide,
    nonRideTask,
    resolveRowId,
    rideId,
    isEnding,
    isStarting,
    user?.uid,
  ]);

  const handleUndo = useCallback(async () => {
    if (!lastEndedSessionRef) return;
    try {
      await endSession(lastEndedSessionRef.id, {
        endTime: lastEndedSessionRef.previousEndTime ?? null,
        rideId: lastEndedSessionRef.rideId ?? null,
        mode: lastEndedSessionRef.mode ?? undefined,
      });
      setSessions((prev) =>
        prev.map((row) =>
          resolveRowId(row) === lastEndedSessionRef.id
            ? {
                ...row,
                endTime: lastEndedSessionRef.previousEndTime ?? null,
                rideId: lastEndedSessionRef.rideId ?? row.rideId ?? null,
              }
            : row,
        ),
      );
      setSnackbarOpen(false);
      setLastEndedSessionRef(null);
    } catch (err) {
      logError(err, {
        where: "TimeClock.undo",
        userId: user?.uid,
        rideId: lastEndedSessionRef?.rideId ?? null,
      });
      setSnackbarError("Undo failed. Session remains ended.");
    }
  }, [lastEndedSessionRef, resolveRowId, user?.uid]);

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

  const tzLabel = useMemo(() => {
    try {
      const base = dayjs().tz ? dayjs().tz(timezoneGuess) : dayjs();
      return base.format("zz");
    } catch (err) {
      logError(err, { where: "TimeClock.tzLabel" });
      return timezoneGuess;
    }
  }, [timezoneGuess]);

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

      {isAdmin && driverOptions.length > 0 && (
        <Autocomplete
          size="small"
          options={driverOptions}
          value={driverFilter}
          onChange={(_event, value) => setDriverFilter(value)}
          getOptionLabel={(option) => option?.label || ""}
          isOptionEqualToValue={(option, value) =>
            option?.value === value?.value
          }
          clearOnEscape
          renderInput={(params) => (
            <TextField
              {...params}
              label="Filter by driver"
              placeholder="Search driver"
            />
          )}
        />
      )}

      {loadError && (
        <Alert severity="warning">
          Failed to load some sessions. Showing cached data.
        </Alert>
      )}

      <Box sx={{ width: "100%" }}>
        <LrpGrid
          rows={gridRows}
          columns={columns}
          getRowId={resolveRowId}
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
