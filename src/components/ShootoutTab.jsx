// src/components/ShootoutTab.jsx
/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Box, Card, CardContent, CardHeader, Typography, Stack,
  IconButton, Button, Fab, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import PeopleIcon from "@mui/icons-material/People";
import UndoIcon from "@mui/icons-material/Undo";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import dayjs from "dayjs";

import { db } from "../firebase";
import {
  collection, doc, setDoc, onSnapshot, query, orderBy, limit, Timestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const STORAGE_CLOCK = "shootoutClock";
const STORAGE_HISTORY = "shootoutHistory";
const SHOOTOUT_COL = "shootoutStats";
const IMG_CADILLAC = "https://logos-world.net/wp-content/uploads/2021/05/Cadillac-Logo.png";
const IMG_SHOOTOUT = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSuQVpBIwemQ40C8l6cpz3508Vxrk2HaWmMNQ&s";

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

function normalizeSession(entry) {
  return {
    ...entry,
    duration: Number.isFinite(entry.duration)
      ? entry.duration
      : (entry.endTime && entry.startTime)
        ? entry.endTime.toMillis() - entry.startTime.toMillis()
        : 0
  };
}

export default function ShootoutTab() {
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trips, setTrips] = useState(0);
  const [passengers, setPassengers] = useState(0);
  const [history, setHistory] = useState([]);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const lastActionRef = useRef(null);
  const intervalRef = useRef(null);

  // ---- Persist current session state
  const persistClock = useCallback((data) => {
    const current = safeParse(localStorage.getItem(STORAGE_CLOCK), {});
    localStorage.setItem(STORAGE_CLOCK, JSON.stringify({ ...current, ...data }));
  }, []);

  const loadClock = useCallback(() => {
    const stored = safeParse(localStorage.getItem(STORAGE_CLOCK), {});
    if (stored.startTime) {
      const start = Timestamp.fromMillis(stored.startTime);
      setStartTime(start);
      setIsRunning(true);
      setTrips(stored.trips || 0);
      setPassengers(stored.passengers || 0);
      setElapsed(Math.floor((Date.now() - start.toMillis()) / 1000));
    }
  }, []);

  const clearIntervalSafe = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
  // ---- Restore local session
  useEffect(() => {
    loadClock();
  }, [loadClock]);

  // ---- Timer sync across visibility/tab change
  useEffect(() => {
    const tick = () => {
      if (isRunning && startTime) {
        setElapsed(Math.floor((Date.now() - startTime.toMillis()) / 1000));
      }
    };
    const onVisibility = () => {
      if (document.hidden) clearIntervalSafe();
      else if (isRunning && startTime && !intervalRef.current) {
        intervalRef.current = setInterval(tick, 1000);
        tick();
      }
    };
    if (isRunning && startTime && !document.hidden) {
      intervalRef.current = setInterval(tick, 1000);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearIntervalSafe();
    };
  }, [isRunning, startTime]);

  // ---- Firestore live listener
  useEffect(() => {
    const q = query(collection(db, SHOOTOUT_COL), orderBy("startTime", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => normalizeSession({ id: doc.id, ...doc.data() }));
      setHistory(data);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(data));
    });
    return () => unsub();
  }, []);

  // ---- Cross-tab localStorage sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_CLOCK) loadClock();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadClock]);

  const handleStart = useCallback(() => {
    const now = Timestamp.now();
    setStartTime(now);
    setIsRunning(true);
    setElapsed(0);
    setTrips(0);
    setPassengers(0);
    localStorage.setItem(STORAGE_CLOCK, JSON.stringify({
      startTime: now.toMillis(),
      trips: 0,
      passengers: 0
    }));
  }, []);

  const finalizeSession = useCallback(async () => {
    if (!startTime) return;
    const auth = getAuth();
    const user = auth.currentUser;
    const endTime = Timestamp.now();
    const duration = Math.floor((endTime.toMillis() - startTime.toMillis()) / 1000);

    const session = {
      startTime,
      endTime,
      duration,
      createdAt: Timestamp.now(),
      trips,
      passengers,
      v: 1,
      createdBy: (user?.email || "unknown").toLowerCase(),
      createdByUid: user?.uid || "",
      eventKey: "shootout-2025"
    };

    const stableId = `${startTime.toMillis()}_${endTime.toMillis()}`;
    await setDoc(doc(db, SHOOTOUT_COL, stableId), session, { merge: true });

    setIsRunning(false);
    setStartTime(null);
    setElapsed(0);
    setTrips(0);
    setPassengers(0);
    localStorage.removeItem(STORAGE_CLOCK);
    lastActionRef.current = null;
  }, [startTime, trips, passengers]);

  const handleEnd = () => setConfirmEndOpen(true);
  const handleConfirmEnd = () => {
    setConfirmEndOpen(false);
    finalizeSession();
  };
  const handleCancelEnd = () => setConfirmEndOpen(false);

  const changeTrips = useCallback((delta) => {
    if (!isRunning) return;
    setTrips(t => {
      const next = Math.max(0, t + delta);
      persistClock({ trips: next });
      lastActionRef.current = { type: "trip", delta };
      return next;
    });
  }, [isRunning, persistClock]);

  const changePassengers = useCallback((delta) => {
    if (!isRunning) return;
    setPassengers(p => {
      const next = Math.max(0, p + delta);
      persistClock({ passengers: next });
      lastActionRef.current = { type: "pax", delta };
      return next;
    });
  }, [isRunning, persistClock]);

  const undoLast = useCallback(() => {
    const last = lastActionRef.current;
    if (!last || !isRunning) return;
    if (last.type === "trip") changeTrips(-last.delta);
    if (last.type === "pax") changePassengers(-last.delta);
    lastActionRef.current = null;
  }, [isRunning, changeTrips, changePassengers]);

  const resetCurrent = useCallback(() => {
    if (!isRunning) return;
    setTrips(0);
    setPassengers(0);
    persistClock({ trips: 0, passengers: 0 });
    lastActionRef.current = null;
  }, [isRunning, persistClock]);
  // ---- Format Time
  const formatElapsed = useCallback((s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  }, []);

  // ---- Grid Columns
  const historyCols = useMemo(() => [
    {
      field: "startTime",
      headerName: "Start",
      width: 160,
      valueFormatter: ({ value }) => {
  const date = value?.toDate?.() || value;
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format("MM/DD HH:mm") : "—";
},
  },
    {
      field: "duration",
      headerName: "Duration",
      width: 130,
      valueFormatter: ({ value }) => formatElapsed(value),
    },
    {
      field: "trips",
      headerName: "Trips",
      width: 90,
      align: "right",
      headerAlign: "right",
    },
    {
      field: "passengers",
      headerName: "Passengers",
      width: 130,
      align: "right",
      headerAlign: "right",
    },
  ], [formatElapsed]);

  const historyRows = useMemo(() => history.map(normalizeSession), [history]);
  const totalTrips = useMemo(() => history.reduce((s, h) => s + (h.trips || 0), 0), [history]);
  const totalPassengers = useMemo(() => history.reduce((s, h) => s + (h.passengers || 0), 0), [history]);
  const avgPassengers = totalTrips ? (totalPassengers / totalTrips).toFixed(2) : "0.00";

  return (
    <Box maxWidth={520} mx="auto">
      <Card sx={{ borderLeft: (t) => `5px solid ${t.palette.success.main}` }}>
        <CardHeader
          title="Shootout Ride & Time Tracker"
          subheader={
            <Box display="flex" justifyContent="center" alignItems="center" flexWrap="wrap" gap={1.5} mt={2}>
              <img src={IMG_SHOOTOUT} alt="Shootout Logo" style={{ height: 40 }} />
              <img src={IMG_CADILLAC} alt="Cadillac Logo" style={{ height: 40 }} />
            </Box>
          }
          sx={{ textAlign: "center" }}
        />
        <CardContent sx={{ textAlign: "center" }}>
          <Box
            sx={{
              display: "inline-block",
              px: 2,
              py: 1,
              mb: 2,
              borderRadius: 1,
              boxShadow: 1,
              bgcolor: (theme) => theme.palette.background.paper,
            }}
          >
            <Typography variant="h3" sx={{ fontSize: { xs: "2.4rem", sm: "3rem", md: "3.4rem" } }}>
              {formatElapsed(elapsed)}
            </Typography>
          </Box>

          {!isRunning ? (
            <Fab
              color="success"
              onClick={handleStart}
              sx={{ mb: 2, "&:active": { transform: "scale(0.96)" } }}
              centerRipple
              aria-label="Start session"
            >
              <PlayArrowIcon />
            </Fab>
          ) : (
            <Stack spacing={1.5} alignItems="center">
              <Fab
                color="error"
                onClick={handleEnd}
                sx={{ mb: 1 }}
                aria-label="End session"
              >
                <StopIcon />
              </Fab>

              <Stack direction="row" spacing={1} alignItems="center">
                <DirectionsCarIcon />
                <Typography>Trips: {trips}</Typography>
                <IconButton color="primary" onClick={() => changeTrips(1)} size="small" aria-label="Add trip">
                  <AddIcon />
                </IconButton>
                <IconButton color="error" onClick={() => changeTrips(-1)} disabled={trips === 0} size="small" aria-label="Remove trip">
                  <RemoveIcon />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="center">
                <PeopleIcon />
                <Typography>Passengers: {passengers}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <Button key={n} variant="outlined" size="small" onClick={() => changePassengers(n)} aria-label={`Add ${n} passengers`}>
                      +{n}
                    </Button>
                  ))}
                </Box>
                <IconButton color="error" onClick={() => changePassengers(-1)} disabled={passengers === 0} size="small" aria-label="Remove passenger">
                  <RemoveIcon />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button onClick={undoLast} startIcon={<UndoIcon />} disabled={!lastActionRef.current} variant="text">
                  Undo
                </Button>
                <Button onClick={resetCurrent} startIcon={<RestartAltIcon />} disabled={!isRunning || (trips === 0 && passengers === 0)}>
                  Reset
                </Button>
              </Stack>
            </Stack>
          )}

          {history.length > 0 && (
            <Box mt={3} textAlign="left">
              <Divider sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Recent Sessions
              </Typography>
              <DataGrid
                autoHeight
                rows={historyRows}
                columns={historyCols}
                getRowId={(r) => r.id || `${r.startTime?.seconds}_${r.endTime?.seconds}`}
                hideFooter
                disableRowSelectionOnClick
                density="compact"
                sx={{
                  "& .MuiDataGrid-columnHeaderTitle": { fontWeight: "bold" },
                  "& .MuiDataGrid-row:nth-of-type(odd)": {
                    backgroundColor: (theme) => theme.palette.action.hover,
                  },
                }}
              />
              <Stack spacing={0.5} mt={1}>
                <Typography><b>Total Trips:</b> {totalTrips}</Typography>
                <Typography><b>Total Passengers:</b> {totalPassengers}</Typography>
                <Typography><b>Passengers/Trip:</b> {avgPassengers}</Typography>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmEndOpen} onClose={handleCancelEnd}>
        <DialogTitle>End Session?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will save the session to history and reset the live counters.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEnd}>Cancel</Button>
          <Button onClick={handleConfirmEnd} color="error" variant="contained">End & Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
