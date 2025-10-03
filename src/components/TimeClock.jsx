import { useCallback, useEffect, useMemo, useState } from "react";
import { serverTimestamp } from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";
import { PlayArrow, Stop } from "@mui/icons-material";

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
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [savingIds, setSavingIds] = useState([]);

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

  const columns = useMemo(() => {
    const base = buildTimeLogColumns();
    return base.map((col) => {
      if (col.field === "clockIn") {
        return {
          ...col,
          type: "dateTime",
          editable: true,
          valueGetter: (params) => {
            const source =
              params?.row?.startTime ??
              params?.row?.clockIn ??
              params?.row?.loggedAt ??
              null;
            return parseEditDate(source);
          },
          valueFormatter: (params) =>
            params?.value ? formatDateTime(params.value) : "N/A",
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
          valueGetter: (params) => {
            const source =
              params?.row?.endTime ?? params?.row?.clockOut ?? null;
            return parseEditDate(source);
          },
          valueFormatter: (params) =>
            params?.value ? formatDateTime(params.value) : "—",
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

        setSnackbarMessage("Time log updated.");
        setSnackbarOpen(true);

        return nextRow;
      } catch (err) {
        logError(err, { where: "TimeClock.processRowUpdate", id });
        setSnackbarMessage("Failed to update time log.");
        setSnackbarOpen(true);
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
      setSnackbarMessage,
      setSnackbarOpen,
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
      setSnackbarMessage("You must be signed in to start a session.");
      setSnackbarOpen(true);
      return;
    }
    if (!nonRideTask && !multiRide && !rideId.trim()) {
      setSnackbarMessage("Enter a Ride ID or choose a task type.");
      setSnackbarOpen(true);
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
      setSnackbarMessage("Clocked in.");
      setSnackbarOpen(true);
    } catch (err) {
      logError(err, { where: "TimeClock.startTimeLog" });
      setSnackbarMessage("Failed to start session.");
      setSnackbarOpen(true);
    } finally {
      setStartBusy(false);
    }
  }, [activeRow, endBusy, multiRide, nonRideTask, rideId, startBusy, user]);

  const handleClockOutSafe = useCallback(async () => {
    if (!activeRow || endBusy) return;
    const id = resolveRowId(activeRow);
    setEndBusy(true);
    try {
      await updateTimeLog(id, { endTime: "server" });
    } catch (err) {
      logError(err, { where: "TimeClock.endTimeLog", id });
      setSnackbarMessage("Failed to end session.");
      setSnackbarOpen(true);
    } finally {
      setEndBusy(false);
    }
  }, [activeRow, endBusy, resolveRowId]);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbarOpen(false);
    setSnackbarMessage("");
  }, []);

  if (roleLoading) {
    return (
      <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Card>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">Time Clock</Typography>
            <Typography variant="body2" color="text.secondary">
              Start a session to begin tracking your time.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "rgba(76,187,23,0.08)",
              border: "1px solid rgba(76,187,23,0.3)",
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
                sx={{ color: "#4cbb17", fontWeight: 600 }}
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
              <Button
                variant="contained"
                color="primary"
                startIcon={<PlayArrow />}
                onClick={handleStart}
                disabled={startBusy || endBusy || Boolean(activeRow)}
              >
                Start
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<Stop />}
                onClick={handleClockOutSafe}
                disabled={!activeRow || endBusy}
              >
                Stop
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ width: "100%" }}>
        <DataGridPro
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
          experimentalFeatures={{ newEditingApi: true }}
          slots={{ toolbar: GridToolbar, noRowsOverlay: NoSessionsOverlay }}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
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

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />
    </Stack>
  );
}
