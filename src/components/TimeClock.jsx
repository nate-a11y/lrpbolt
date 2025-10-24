import { useCallback, useEffect, useMemo, useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { keyframes } from "@mui/system";
import { PlayArrow, Stop } from "@mui/icons-material";

import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";
import { useAuth } from "@/context/AuthContext.jsx";
import logError from "@/utils/logError.js";
import { logTime, subscribeTimeLogs, updateTimeLog } from "@/services/fs";
import { buildTimeLogColumns } from "@/components/datagrid/columns/timeLogColumns.shared.jsx";
import {
  dayjs,
  toDayjs,
  formatDateTime,
  durationSafe,
  formatDuration,
  isActiveRow,
} from "@/utils/time";
import { getRowId as pickId } from "@/utils/timeLogMap";
import { timestampSortComparator } from "@/utils/timeUtils.js";
import ErrorBoundary from "@/components/feedback/ErrorBoundary.jsx";
import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { vibrateOk, vibrateWarn } from "@/utils/haptics.js";

const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
`;

function NoSessionsOverlay() {
  return (
    <Stack
      height="100%"
      alignItems="center"
      justifyContent="center"
      spacing={1}
      sx={{ py: 2 }}
    >
      <Typography variant="body2" color="text.secondary">
        No sessions yet.
      </Typography>
    </Stack>
  );
}

export default function TimeClock({ setIsTracking }) {
  const { user, roleLoading } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rideId, setRideId] = useState("");
  const [nonRideTask, setNonRideTask] = useState(false);
  const [multiRide, setMultiRide] = useState(false);
  const [startBusy, setStartBusy] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [savingIds, setSavingIds] = useState([]);
  const { show: showSnack } = useSnack();

  const announce = useCallback((message) => {
    if (typeof window === "undefined") return;
    window.__LRP_LIVE_MSG__ = message || "";
    try {
      window.dispatchEvent(
        new CustomEvent("lrp:live-region", { detail: message || "" }),
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[TimeClock] live region dispatch failed", error);
      }
    }
  }, []);

  const showSuccessSnack = useCallback(
    (message, options = {}) => {
      if (!message) return;
      vibrateOk();
      announce(message);
      showSnack(message, "success", options);
    },
    [announce, showSnack],
  );

  const showWarnOrErrorSnack = useCallback(
    (message, severity = "warning", options = {}) => {
      if (!message) return;
      vibrateWarn();
      announce(message);
      showSnack(message, severity, options);
    },
    [announce, showSnack],
  );

  const showInfoSnack = useCallback(
    (message, options = {}) => {
      if (!message) return;
      announce(message);
      showSnack(message, "info", options);
    },
    [announce, showSnack],
  );

  const driverQueryValues = useMemo(() => {
    if (!user) return [];
    const values = [];
    const seen = new Set();
    const push = (value) => {
      if (value == null) return;
      const str = String(value).trim();
      if (!str) return;
      if (seen.has(str)) return;
      seen.add(str);
      values.push(str);
    };

    push(user.uid);
    push(user.displayName);
    push(user.email);
    if (typeof user?.email === "string") {
      push(user.email.toLowerCase());
    }
    return values;
  }, [user]);

  const identityLookup = useMemo(() => {
    const set = new Set();
    driverQueryValues.forEach((value) => {
      const str = String(value).trim();
      if (!str) return;
      set.add(str.toLowerCase());
    });
    if (user?.uid) set.add(String(user.uid).toLowerCase());
    if (user?.email) set.add(String(user.email).toLowerCase());
    if (user?.displayName) set.add(String(user.displayName).toLowerCase());
    return set;
  }, [driverQueryValues, user]);

  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeTimeLogs({
      key: driverQueryValues.length ? driverQueryValues : null,
      limit: 200,
      onData: (data) => {
        const baseRows = Array.isArray(data) ? data : [];
        const filtered = baseRows.filter((row) => {
          if (!row) return false;
          const candidates = [
            row.driverKey,
            row.driverId,
            row.userId,
            row.driver,
            row.driverName,
            row.driverEmail,
            row.userEmail,
          ];
          return candidates.some((candidate) => {
            if (candidate == null) return false;
            const str = String(candidate).trim().toLowerCase();
            return identityLookup.has(str);
          });
        });
        setRows(filtered);
        setLoading(false);
      },
      onError: (err) => {
        logError(err, { where: "TimeClock.subscribeTimeLogs" });
        setError("Failed to load time logs.");
        setLoading(false);
      },
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [driverQueryValues, identityLookup, user]);

  const activeRow = useMemo(
    () => rows.find((row) => isActiveRow(row)) || null,
    [rows],
  );

  useEffect(() => {
    if (typeof setIsTracking === "function") {
      setIsTracking(Boolean(activeRow));
    }
  }, [activeRow, setIsTracking]);

  useEffect(() => {
    if (!rows?.some?.((row) => isActiveRow(row))) {
      return undefined;
    }
    const t = setInterval(() => setRows((prev) => [...prev]), 60000);
    return () => clearInterval(t);
  }, [rows]);

  useEffect(() => {
    if (!activeRow) {
      setNonRideTask(false);
      setMultiRide(false);
      setRideId("");
      return;
    }
    const mode = activeRow?.mode || "RIDE";
    setNonRideTask(mode === "N/A");
    setMultiRide(mode === "MULTI");
    if (mode === "RIDE") {
      setRideId(activeRow?.rideId || "");
    } else {
      setRideId("");
    }
  }, [activeRow]);

  const parseEditDate = useCallback((value) => {
    if (value == null) return null;
    if (value instanceof Date) {
      return Number.isFinite(value.getTime()) ? value : null;
    }
    if (dayjs.isDayjs?.(value)) {
      const asDate = value.toDate();
      return Number.isFinite(asDate?.getTime?.()) ? asDate : null;
    }
    const parsed = toDayjs(value);
    if (!parsed) return null;
    const asDate = parsed.toDate();
    return Number.isFinite(asDate?.getTime?.()) ? asDate : null;
  }, []);

  const hasDateChanged = useCallback((next, prev) => {
    if (!next && !prev) return false;
    if (!next || !prev) return true;
    return next.getTime() !== prev.getTime();
  }, []);

  const markSaving = useCallback((id, saving) => {
    if (!id) return;
    setSavingIds((prev) => {
      const exists = prev.includes(id);
      if (saving) {
        return exists ? prev : [...prev, id];
      }
      return exists ? prev.filter((item) => item !== id) : prev;
    });
  }, []);

  // MUI DataGrid Pro v7 API: valueGetter/valueFormatter signature is (value, row, column, apiRef)
  const columns = useMemo(() => {
    const base = buildTimeLogColumns();
    return base.map((col) => {
      if (col.field === "clockIn") {
        return {
          ...col,
          type: "dateTime",
          editable: true,
          valueGetter: (value, row) => {
            const source =
              row?.startTime ?? row?.clockIn ?? row?.loggedAt ?? null;
            return parseEditDate(source);
          },
          valueFormatter: (value) => (value ? formatDateTime(value) : "N/A"),
          valueSetter: (params) => {
            const baseRow =
              params?.row && typeof params.row === "object" ? params.row : {};
            const next = { ...baseRow };
            const parsed = parseEditDate(params?.value ?? null);
            next.startTime = parsed;
            next.clockIn = parsed;
            return next;
          },
          sortComparator: (v1, v2, cellParams1, cellParams2) =>
            timestampSortComparator(
              cellParams1?.row?.startTime ??
                cellParams1?.row?.clockIn ??
                cellParams1?.row?.loggedAt ??
                null,
              cellParams2?.row?.startTime ??
                cellParams2?.row?.clockIn ??
                cellParams2?.row?.loggedAt ??
                null,
            ),
        };
      }
      if (col.field === "clockOut") {
        return {
          ...col,
          type: "dateTime",
          editable: true,
          valueGetter: (value, row) => {
            const source = row?.endTime ?? row?.clockOut ?? null;
            return parseEditDate(source);
          },
          valueFormatter: (value) => (value ? formatDateTime(value) : "—"),
          valueSetter: (params) => {
            const baseRow =
              params?.row && typeof params.row === "object" ? params.row : {};
            const next = { ...baseRow };
            const parsed = parseEditDate(params?.value ?? null);
            next.endTime = parsed;
            next.clockOut = parsed;
            return next;
          },
          sortComparator: (v1, v2, cellParams1, cellParams2) =>
            timestampSortComparator(
              cellParams1?.row?.endTime ?? cellParams1?.row?.clockOut ?? null,
              cellParams2?.row?.endTime ?? cellParams2?.row?.clockOut ?? null,
            ),
        };
      }
      return col;
    });
  }, [parseEditDate]);
  const baseRowId = useCallback(
    (row) => row?.id || row?.docId || row?._id || null,
    [],
  );

  const resolveRowId = useCallback(
    (row) => {
      const candidate = baseRowId(row) || pickId(row);
      if (candidate) return candidate;
      const email = row?.driverEmail || row?.userEmail || "driver";
      const startKey = row?.startTime?.seconds ?? row?.startTime ?? "start";
      return `${email}-${startKey}`;
    },
    [baseRowId],
  );

  const isCellEditable = useCallback(
    (params) => {
      if (!params?.row) return false;
      if (loading) return false;
      if (params.field !== "clockIn" && params.field !== "clockOut") {
        return false;
      }
      const id = resolveRowId(params.row);
      if (!id) return false;
      return !savingIds.includes(id);
    },
    [loading, resolveRowId, savingIds],
  );

  const applyLocalUpdate = useCallback(
    (id, updater) => {
      setRows((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        let changed = false;
        const next = prev.map((row) => {
          const rowId = resolveRowId(row);
          if (rowId !== id) return row;
          changed = true;
          return typeof updater === "function" ? updater(row) : updater;
        });
        return changed ? next : prev;
      });
    },
    [resolveRowId],
  );

  const handleProcessRowUpdate = useCallback(
    async (newRow, oldRow) => {
      const id = resolveRowId(newRow) || resolveRowId(oldRow);
      if (!id) return oldRow;

      const newStart = parseEditDate(
        newRow?.startTime ?? newRow?.clockIn ?? newRow?.loggedAt ?? null,
      );
      const prevStart = parseEditDate(
        oldRow?.startTime ?? oldRow?.clockIn ?? oldRow?.loggedAt ?? null,
      );
      const newEnd = parseEditDate(newRow?.endTime ?? newRow?.clockOut ?? null);
      const prevEnd = parseEditDate(
        oldRow?.endTime ?? oldRow?.clockOut ?? null,
      );

      const startChanged = hasDateChanged(newStart, prevStart);
      const endChanged = hasDateChanged(newEnd, prevEnd);

      if (!startChanged && !endChanged) {
        return oldRow;
      }

      markSaving(id, true);

      const updates = {};
      if (startChanged) updates.startTime = newStart;
      if (endChanged) updates.endTime = newEnd;

      try {
        await updateTimeLog(id, updates);

        const nextRow = {
          ...oldRow,
          ...newRow,
          startTime: startChanged ? newStart : (oldRow.startTime ?? null),
          clockIn: startChanged ? newStart : (oldRow.clockIn ?? null),
          endTime: endChanged ? newEnd : (oldRow.endTime ?? null),
          clockOut: endChanged ? newEnd : (oldRow.clockOut ?? null),
        };

        nextRow.id = resolveRowId(oldRow) || id;
        if (oldRow?.docId) nextRow.docId = oldRow.docId;
        if (oldRow?.originalId) nextRow.originalId = oldRow.originalId;

        const durationMs = durationSafe(newStart, newEnd);
        nextRow.duration =
          durationMs > 0 ? Math.floor(durationMs / 60000) : null;

        applyLocalUpdate(id, nextRow);

        showInfoSnack("Time log updated.");

        return nextRow;
      } catch (err) {
        logError(err, { where: "TimeClock.processRowUpdate", id });
        showWarnOrErrorSnack("Failed to update time log.", "error");
        return oldRow;
      } finally {
        markSaving(id, false);
      }
    },
    [
      applyLocalUpdate,
      hasDateChanged,
      markSaving,
      parseEditDate,
      resolveRowId,
      showInfoSnack,
      showWarnOrErrorSnack,
    ],
  );

  const active = activeRow || null;
  const activeSince = active
    ? active.startTs ||
      active.startTime ||
      active.clockIn ||
      active.loggedAt ||
      null
    : null;
  const activeDurationMs = activeSince ? durationSafe(activeSince, dayjs()) : 0;
  const activeDurationLabel =
    activeDurationMs > 0 ? formatDuration(activeDurationMs) : "N/A";

  const handleStart = useCallback(async () => {
    if (!user) {
      showWarnOrErrorSnack(
        "You must be signed in to start a session.",
        "warning",
      );
      return;
    }
    if (!nonRideTask && !multiRide && !rideId.trim()) {
      showWarnOrErrorSnack("Enter a Ride ID or choose a task type.", "warning");
      return;
    }
    if (startBusy || endBusy || activeRow) return;

    const trimmed = rideId.trim().toUpperCase();
    const mode = nonRideTask ? "N/A" : multiRide ? "MULTI" : "RIDE";

    setStartBusy(true);
    try {
      const uid = user?.uid ? String(user.uid).trim() : "";
      const emailRaw =
        typeof user?.email === "string" ? String(user.email).trim() : "";
      const emailNormalized = emailRaw ? emailRaw.toLowerCase() : null;
      const driverKey =
        uid ||
        emailNormalized ||
        (emailRaw ? emailRaw : "") ||
        (user?.displayName ? String(user.displayName).trim() : "") ||
        "unknown";
      const rideValue = mode === "RIDE" ? trimmed || "N/A" : "N/A";
      const driverName =
        user?.displayName ||
        emailRaw ||
        (emailNormalized ? emailNormalized.split("@")[0] : "Unknown");

      await logTime({
        driverKey,
        driverId: uid || null,
        userId: uid || driverKey || null,
        driverName,
        driverEmail: emailNormalized,
        userEmail: emailNormalized,
        rideId: rideValue,
        mode,
        startTs: serverTimestamp(),
        status: "open",
      });
      setRideId("");
      showSuccessSnack("Clocked in");
    } catch (err) {
      logError(err, { where: "TimeClock.startTimeLog" });
      showWarnOrErrorSnack("Failed to start session.", "error");
    } finally {
      setStartBusy(false);
    }
  }, [
    activeRow,
    endBusy,
    multiRide,
    nonRideTask,
    rideId,
    showSuccessSnack,
    showWarnOrErrorSnack,
    startBusy,
    user,
  ]);

  const handleClockOutSafe = useCallback(async () => {
    if (!activeRow || endBusy) return;
    const id = resolveRowId(activeRow);
    if (!id) {
      showWarnOrErrorSnack("Missing time log identifier.", "error");
      return;
    }
    setEndBusy(true);
    try {
      const startReference =
        activeRow.startTs ||
        activeRow.startTime ||
        activeRow.clockIn ||
        activeRow.loggedAt ||
        null;
      const driverKey =
        (activeRow.driverKey && String(activeRow.driverKey).trim()) ||
        (activeRow.driverId && String(activeRow.driverId).trim()) ||
        (activeRow.userId && String(activeRow.userId).trim()) ||
        (user?.uid && String(user.uid).trim()) ||
        (user?.email && String(user.email).trim().toLowerCase()) ||
        null;
      await logTime({
        id,
        driverKey: driverKey || undefined,
        driverId: activeRow.driverId ?? activeRow.userId ?? user?.uid ?? null,
        userId: activeRow.userId ?? activeRow.driverId ?? user?.uid ?? null,
        driverName: activeRow.driverName ?? user?.displayName ?? null,
        driverEmail:
          activeRow.driverEmail ??
          activeRow.userEmail ??
          (typeof user?.email === "string" ? user.email.toLowerCase() : null),
        userEmail:
          activeRow.userEmail ??
          activeRow.driverEmail ??
          (typeof user?.email === "string" ? user.email.toLowerCase() : null),
        rideId: activeRow.rideId ?? "N/A",
        mode: activeRow.mode ?? (activeRow.rideId ? "RIDE" : "N/A"),
        startTs: startReference ?? serverTimestamp(),
        endTs: serverTimestamp(),
        status: "closed",
      });
      showSuccessSnack("Clocked out");
    } catch (err) {
      logError(err, { where: "TimeClock.endTimeLog", id });
      showWarnOrErrorSnack("Failed to end session.", "error");
    } finally {
      setEndBusy(false);
    }
  }, [
    activeRow,
    endBusy,
    resolveRowId,
    showSuccessSnack,
    showWarnOrErrorSnack,
    user?.displayName,
    user?.email,
    user?.uid,
  ]);

  if (roleLoading) {
    return (
      <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <ErrorBoundary>
      <Stack spacing={2} sx={{ width: "100%" }}>
        <Card>
          <CardContent
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <Stack spacing={0.5}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                ⏰ Time Clock
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start a session to begin tracking your time.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                border: (t) =>
                  `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
                borderRadius: 2,
                px: 2,
                py: 1,
                mb: 2,
                animation: active ? `${pulse} 2s infinite` : "none",
              }}
            >
              {active ? (
                <Typography
                  variant="body1"
                  sx={{ color: (t) => t.palette.primary.main, fontWeight: 600 }}
                >
                  Active since {formatDateTime(activeSince)} — Duration:{" "}
                  {activeDurationLabel}
                </Typography>
              ) : (
                <Typography variant="body1" sx={{ color: "text.secondary" }}>
                  No active session
                </Typography>
              )}
            </Box>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <TextField
                label="Ride ID"
                value={rideId}
                onChange={(event) => setRideId(event.target.value)}
                disabled={Boolean(activeRow) || nonRideTask || multiRide}
                size="small"
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Checkbox
                    checked={nonRideTask}
                    onChange={(event) => {
                      setNonRideTask(event.target.checked);
                      if (event.target.checked) {
                        setMultiRide(false);
                        setRideId("");
                      }
                    }}
                    disabled={Boolean(activeRow)}
                    size="small"
                  />
                  <Typography variant="body2">Non-Ride Task</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Checkbox
                    checked={multiRide}
                    onChange={(event) => {
                      setMultiRide(event.target.checked);
                      if (event.target.checked) {
                        setNonRideTask(false);
                        setRideId("");
                      }
                    }}
                    disabled={Boolean(activeRow)}
                    size="small"
                  />
                  <Typography variant="body2">Multiple Rides</Typography>
                </Stack>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <LoadingButtonLite
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrow />}
                  onClick={handleStart}
                  disabled={Boolean(activeRow)}
                  loading={startBusy}
                  loadingText="Starting…"
                >
                  Start
                </LoadingButtonLite>
                <LoadingButtonLite
                  variant="outlined"
                  color="inherit"
                  startIcon={<Stop />}
                  onClick={handleClockOutSafe}
                  disabled={!activeRow}
                  loading={endBusy}
                  loadingText="Stopping…"
                >
                  Stop
                </LoadingButtonLite>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ width: "100%" }}>
          <LrpDataGridPro
            id="time-clock-grid"
            autoHeight
            rows={Array.isArray(rows) ? rows : []}
            columns={columns}
            getRowId={resolveRowId}
            loading={loading}
            density="compact"
            disableRowSelectionOnClick
            isCellEditable={isCellEditable}
            processRowUpdate={handleProcessRowUpdate}
            editMode="row"
            slots={{ noRowsOverlay: NoSessionsOverlay }}
            slotProps={{
              toolbar: {
                quickFilterPlaceholder: "Search sessions",
              },
            }}
            sx={{
              borderRadius: 2,
              backgroundColor: (theme) => theme.palette.background.paper,
              "& .MuiDataGrid-columnHeaders": {
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
              },
            }}
          />
        </Box>
      </Stack>
    </ErrorBoundary>
  );
}
