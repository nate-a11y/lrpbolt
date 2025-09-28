import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  subscribeMyTimeLogs,
  startTimeLog,
  endTimeLog,
} from "@/services/timeLogs";
import { buildTimeLogColumns } from "@/components/datagrid/columns/timeLogColumns.shared.jsx";
import { isActiveRow, formatDateTime, safeDuration } from "@/utils/time";
import { getRowId as pickId } from "@/utils/timeLogMap";

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

  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeMyTimeLogs({
      user,
      onData: (data) => {
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      },
      onError: (err) => {
        logError(err, { where: "TimeClock.subscribeMyTimeLogs" });
        setError("Failed to load time logs.");
        setLoading(false);
      },
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user]);

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
    if (
      !rows?.some?.((row) => {
        const start = row?.startTime ?? row?.clockIn ?? row?.loggedAt;
        const end = row?.endTime ?? row?.clockOut;
        return !!start && !end;
      })
    ) {
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

  const columns = useMemo(() => buildTimeLogColumns(), []);
  const getRowId = useCallback(
    (row) => row?.id || row?.docId || row?._id || null,
    [],
  );

  const resolveRowId = useCallback(
    (row) => {
      const candidate = getRowId(row) || pickId(row);
      if (candidate) return candidate;
      const email = row?.driverEmail || row?.userEmail || "driver";
      const startKey = row?.startTime?.seconds ?? row?.startTime ?? "start";
      return `${email}-${startKey}`;
    },
    [getRowId],
  );

  const active = activeRow || null;
  const activeSince = active
    ? active.startTime || active.clockIn || active.loggedAt || null
    : null;

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
      await startTimeLog({
        user,
        rideId: mode === "RIDE" ? trimmed || "N/A" : "N/A",
        mode,
      });
      setRideId("");
    } catch (err) {
      logError(err, { where: "TimeClock.startTimeLog" });
      setSnackbarMessage("Failed to start session.");
      setSnackbarOpen(true);
    } finally {
      setStartBusy(false);
    }
  }, [activeRow, endBusy, multiRide, nonRideTask, rideId, startBusy, user]);

  const handleStop = useCallback(async () => {
    if (!activeRow || endBusy) return;
    const id = resolveRowId(activeRow);
    setEndBusy(true);
    try {
      await endTimeLog({ id });
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
                {safeDuration(activeSince, null)}
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
                onClick={handleStop}
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
          rows={rows}
          columns={columns}
          getRowId={getRowId}
          loading={loading}
          density="compact"
          disableRowSelectionOnClick
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
