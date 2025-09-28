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

import {
  durationHM,
  durationMinutes,
  timestampSortComparator,
  tsToDayjs,
} from "@/utils/timeUtils.js";
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
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({});
  const [liveTick, setLiveTick] = useState(0);

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

  useEffect(() => {
    if (!isAdmin) {
      setSelectedDriverId(null);
    }
  }, [isAdmin]);

  const timezoneGuess = useMemo(() => {
    try {
      return dayjs.tz?.guess?.() || "UTC";
    } catch (err) {
      logError(err, { where: "TimeClock.tzGuess" });
      return "UTC";
    }
  }, []);

  const formatClock = useCallback((timestamp) => {
    const parsed = tsToDayjs(timestamp);
    if (!parsed) return { label: "N/A", relative: "" };
    try {
      return {
        label: parsed.format("MMM D, h:mm A"),
        relative: parsed.fromNow?.() || "",
      };
    } catch (err) {
      logError(err, { where: "TimeClock.formatClock" });
      return {
        label: parsed.format("MMM D, h:mm A"),
        relative: parsed.fromNow?.() || "",
      };
    }
  }, []);

  useEffect(() => {
    if (!isAdmin && !user?.uid) {
      setSessions([]);
      setLoading(false);
      setLoadError(null);
      return undefined;
    }

    setLoading(true);
    setLoadError(null);

    const criteria = { limit: 200 };
    if (isAdmin) {
      if (selectedDriverId) criteria.userId = selectedDriverId;
    } else if (user?.uid) {
      criteria.userId = user.uid;
    }

    const unsubscribe = subscribeTimeLogs(
      criteria,
      async (rows) => {
        try {
          const enriched = await enrichDriverNames(rows || []);
          if (!mountedRef.current) return;
          const normalized = (enriched || []).map((row) => {
            const email = row?.driverEmail || row?.userEmail || "";
            const rowUserId = row?.userId || row?.driverId || row?.uid || null;
            const fallbackFromEmail =
              typeof email === "string" && email.includes("@")
                ? email.split("@")[0]
                : email;
            const resolvedName =
              row?.driverName ||
              row?.driver ||
              (rowUserId && rowUserId === user?.uid && user?.displayName) ||
              fallbackFromEmail ||
              (!isAdmin && user?.displayName ? user.displayName : "") ||
              "N/A";
            const startTs = row?.startTime ?? null;
            const endTs = row?.endTime ?? null;
            const durationMins = durationMinutes(startTs, endTs);

            return {
              ...row,
              id:
                row?.id ||
                row?.docId ||
                row?._id ||
                `${rowUserId || email || "unknown"}-${
                  row?.startTime?.seconds ?? row?.startTime ?? "start"
                }`,
              userId: rowUserId,
              driverEmail: email,
              driverName: resolvedName,
              startTime: startTs,
              endTime: endTs,
              durationMinutes: durationMins,
            };
          });
          setSessions(normalized);
          setLoading(false);
        } catch (err) {
          logError(err, { where: "TimeClock.subscribe.enrich", criteria });
          if (!mountedRef.current) return;
          setLoadError(err);
          setLoading(false);
        }
      },
      (err) => {
        if (!mountedRef.current) return;
        logError(err, { where: "TimeClock.subscribe.listener", criteria });
        setLoadError(err);
        setLoading(false);
      },
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [isAdmin, selectedDriverId, user?.displayName, user?.uid]);

  const driverOptions = useMemo(() => {
    if (!isAdmin) return [];
    const map = new Map();
    (sessions || []).forEach((row) => {
      const uid = row?.userId;
      if (!uid || map.has(uid)) return;
      const email = row?.driverEmail || row?.userEmail || "";
      const baseName =
        row?.driverName && row.driverName !== "N/A"
          ? row.driverName
          : row?.driver || null;
      const fallbackName =
        baseName ||
        (typeof email === "string" && email.includes("@")
          ? email.split("@")[0]
          : email) ||
        "N/A";
      map.set(uid, {
        id: uid,
        name: fallbackName,
        email,
      });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [isAdmin, sessions]);

  const selectedDriverOption = useMemo(() => {
    if (!selectedDriverId) return null;
    return (
      driverOptions.find((option) => option.id === selectedDriverId) || null
    );
  }, [driverOptions, selectedDriverId]);

  const filteredSessions = useMemo(() => {
    if (!isAdmin) return sessions;
    if (!selectedDriverId) return sessions;
    return (sessions || []).filter((row) => row?.userId === selectedDriverId);
  }, [isAdmin, selectedDriverId, sessions]);

  const resolveRowId = useCallback((row) => {
    if (!row) return "missing-row";
    if (row.id) return row.id;
    const email = row?.driverEmail || row?.userEmail || "unknown";
    const startKey = row?.startTime?.seconds ?? row?.startTime ?? "start";
    return `${email}-${startKey}`;
  }, []);

  const gridRows = useMemo(() => {
    return (filteredSessions || []).map((row) => {
      const driverEmail = row?.driverEmail || row?.userEmail || "";
      const rowUserId = row?.userId || row?.driverId || row?.uid || null;
      const fallbackFromEmail =
        typeof driverEmail === "string" && driverEmail.includes("@")
          ? driverEmail.split("@")[0]
          : driverEmail;
      const resolvedName =
        row?.driverName ||
        row?.driver ||
        (rowUserId && rowUserId === user?.uid && user?.displayName) ||
        fallbackFromEmail ||
        (!isAdmin && user?.displayName ? user.displayName : "") ||
        "N/A";
      return {
        ...row,
        id: resolveRowId(row),
        userId: rowUserId,
        driverEmail,
        driverName: resolvedName,
      };
    });
  }, [filteredSessions, isAdmin, resolveRowId, user?.displayName, user?.uid]);

  const activeSession = useMemo(() => {
    if (!user?.email && !user?.uid) return null;
    const email = user?.email?.toLowerCase?.() || "";
    const uid = user?.uid || null;
    return (
      (sessions || []).find((row) => {
        const rowEmail =
          row?.driverEmail?.toLowerCase?.() || row?.userEmail?.toLowerCase?.();
        const rowUserId = row?.userId || row?.driverId || null;
        const sameDriverId = driver && row?.driverId && row.driverId === driver;
        return (
          !row?.endTime &&
          ((uid && rowUserId === uid) || rowEmail === email || sameDriverId)
        );
      }) || null
    );
  }, [driver, sessions, user?.email, user?.uid]);

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

  const activeDurationText = useMemo(() => {
    const start = tsToDayjs(activeSession?.startTime);
    if (!start || !start.isValid()) return "N/A";
    const fallbackNow = () => {
      try {
        const base = dayjs().tz ? dayjs().tz(timezoneGuess) : dayjs();
        // Incorporate liveTick into the memo dependency without shifting the time.
        return base.add(liveTick * 0, "minute");
      } catch (err) {
        logError(err, { where: "TimeClock.activeDuration.now" });
        return dayjs();
      }
    };
    const end = tsToDayjs(activeSession?.endTime) || fallbackNow();
    if (!end || !end.isValid() || end.isBefore(start)) return "N/A";
    const totalMinutes = Math.max(end.diff(start, "minute"), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
  }, [
    activeSession?.endTime,
    activeSession?.startTime,
    liveTick,
    timezoneGuess,
  ]);

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
        valueGetter: (params) => params?.row?.startTime ?? null,
        valueFormatter: ({ value }) => formatClock(value).label,
        renderCell: (params) => {
          const { label, relative } = formatClock(params?.value);
          if (!label || label === "N/A") return "N/A";
          return (
            <Tooltip title={relative || ""} placement="top">
              <span>{label}</span>
            </Tooltip>
          );
        },
        sortComparator: timestampSortComparator,
      },
      {
        field: "clockOut",
        headerName: "Clock Out",
        minWidth: 160,
        flex: 1,
        valueGetter: (params) => params?.row?.endTime ?? null,
        valueFormatter: ({ value }) => formatClock(value).label,
        renderCell: (params) => {
          const { label, relative } = formatClock(params?.value);
          if (!label || label === "N/A") return "N/A";
          return (
            <Tooltip title={relative || ""} placement="top">
              <span>{label}</span>
            </Tooltip>
          );
        },
        sortComparator: timestampSortComparator,
      },
      {
        field: "duration",
        headerName: "Duration",
        minWidth: 120,
        valueGetter: (params) =>
          durationHM(params?.row?.startTime, params?.row?.endTime),
        sortComparator: (v1, v2, cellParams1, cellParams2) => {
          const first = durationMinutes(
            cellParams1?.row?.startTime,
            cellParams1?.row?.endTime,
          );
          const second = durationMinutes(
            cellParams2?.row?.startTime,
            cellParams2?.row?.endTime,
          );
          if (first == null && second == null) return 0;
          if (first == null) return -1;
          if (second == null) return 1;
          return first - second;
        },
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
        userId: user?.uid ?? null,
        driverName: user?.displayName ?? null,
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
    user?.displayName,
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
          value={selectedDriverOption}
          onChange={(_event, option) => setSelectedDriverId(option?.id ?? null)}
          getOptionLabel={(option) => option?.name || ""}
          isOptionEqualToValue={(option, value) => option?.id === value?.id}
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
