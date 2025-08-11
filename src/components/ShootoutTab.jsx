// src/components/ShootoutTab.jsx
/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Box, Card, CardContent, CardHeader, Typography, Stack,
  IconButton, Button, Fab, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, Alert
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

import {
  addDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { waitForAuth } from "../utils/waitForAuth";

const STORAGE_CLOCK = "shootoutClock";
const SHOOTOUT_COL = "shootoutStats";
const IMG_CADILLAC = "https://logos-world.net/wp-content/uploads/2021/05/Cadillac-Logo.png";
const IMG_SHOOTOUT = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSuQVpBIwemQ40C8l6cpz3508Vxrk2HaWmMNQ&s";
const tsToDate = (ts) => (ts && typeof ts.toDate === "function" ? ts.toDate() : null);

async function startShootoutSession(initial = {}) {
  const user = await waitForAuth(true);
  const userEmail = (user.email || "").toLowerCase();
  return addDoc(collection(db, SHOOTOUT_COL), {
    userEmail,
    startTime: serverTimestamp(),
    endTime: null,
    trips: Number(initial.trips ?? 0),
    passengers: Number(initial.passengers ?? 0),
    createdAt: serverTimestamp(),
  });
}

async function stopShootoutSession(id, data) {
  await waitForAuth(true);
  return updateDoc(doc(db, SHOOTOUT_COL, id), {
    endTime: serverTimestamp(),
    trips: Number(data.trips ?? 0),
    passengers: Number(data.passengers ?? 0),
    updatedAt: serverTimestamp(),
  });
}

function safeParse(json, fallback = {}) {
  try {
    return JSON.parse(json);
  } catch (e) {
    // return fallback on parse error
    return fallback;
  }
}


export default function ShootoutTab() {
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trips, setTrips] = useState(0);
  const [passengers, setPassengers] = useState(0);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const lastActionRef = useRef(null);
  const intervalRef = useRef(null);

  const persistClock = useCallback((data) => {
    const current = safeParse(localStorage.getItem(STORAGE_CLOCK));
    localStorage.setItem(STORAGE_CLOCK, JSON.stringify({ ...current, ...data }));
  }, []);

  const loadClock = useCallback(() => {
    const stored = safeParse(localStorage.getItem(STORAGE_CLOCK));
    if (stored.startTime) {
      try {
        const ts = Timestamp.fromMillis(stored.startTime);
        setStartTime(ts);
        setElapsed(Math.floor((Date.now() - ts.toMillis()) / 1000));
        setIsRunning(true);
        setTrips(stored.trips || 0);
        setPassengers(stored.passengers || 0);
        setSessionId(stored.sessionId || null);
      } catch (err) {
        console.warn("Corrupted startTime in localStorage. Resetting clock.");
        localStorage.removeItem(STORAGE_CLOCK);
      }
    }
  }, []);

  useEffect(() => loadClock(), [loadClock]);

  useEffect(() => {
    const tick = () => {
      if (isRunning && startTime) {
        try {
          setElapsed(Math.floor((Date.now() - startTime.toMillis()) / 1000));
        } catch (err) {
          console.warn("Tick failed:", err);
        }
      }
    };
    const onVis = () => {
      if (document.hidden) clearInterval(intervalRef.current);
      else if (isRunning && startTime && !intervalRef.current) {
        intervalRef.current = setInterval(tick, 1000);
        tick();
      }
    };
    if (isRunning && startTime) {
      intervalRef.current = setInterval(tick, 1000);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isRunning, startTime]);

  useEffect(() => {
    let unsub = () => {};
    let mounted = true;
    (async () => {
      try {
        const user = await waitForAuth(true);
        if (!mounted) return;
        const email = (user.email || "").toLowerCase();

        let isAdmin = false;
        try {
          const snap = await getDoc(doc(db, "userAccess", email));
          isAdmin = snap.exists && String(snap.data().access || "").toLowerCase() === "admin";
        } catch (e) {
          console.error("userAccess check failed", e);
        }

        const base = collection(db, SHOOTOUT_COL);
        const q = isAdmin
          ? query(base, orderBy("createdAt", "desc"), limit(200))
          : query(base, where("userEmail", "==", email), orderBy("createdAt", "desc"), limit(200));

        unsub = onSnapshot(
          q,
          (snap) => {
            const next = snap.docs.map((d) => {
              const data = d.data();
              const st = tsToDate(data.startTime);
              const et = tsToDate(data.endTime);
              const duration = st && et ? Math.floor((et - st) / 1000) : 0;
              return { id: d.id, ...data, startTime: st, endTime: et, duration };
            });
            setRows(next);
            setErr(null);
          },
          (e) => {
            console.error("[ShootoutTab] onSnapshot error:", e);
            setErr(e?.code || e?.message || "Unknown error");
          }
        );
      } catch (e) {
        console.error("[ShootoutTab] subscribe failed:", e);
        setErr(e?.message || "subscribe failed");
      }
    })();
    return () => {
      mounted = false;
      try {
        unsub();
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    const listener = (e) => {
      if (e.key === STORAGE_CLOCK) loadClock();
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [loadClock]);

  const handleStart = async () => {
    try {
      const ref = await startShootoutSession();
      setSessionId(ref.id);
      const now = Timestamp.now();
      setStartTime(now);
      setElapsed(0);
      setIsRunning(true);
      setTrips(0);
      setPassengers(0);
      persistClock({ startTime: now.toMillis(), sessionId: ref.id, trips: 0, passengers: 0 });
    } catch (e) {
      console.error("startShootoutSession failed", e);
      setErr(e.message);
    }
  };

  const handleEnd = () => setConfirmEndOpen(true);
  const handleConfirmEnd = async () => {
    setConfirmEndOpen(false);
    try {
      if (sessionId) {
        await stopShootoutSession(sessionId, { trips, passengers });
      }
      setStartTime(null);
      setElapsed(0);
      setIsRunning(false);
      setTrips(0);
      setPassengers(0);
      setSessionId(null);
      localStorage.removeItem(STORAGE_CLOCK);
      lastActionRef.current = null;
    } catch (e) {
      setErr(e.message);
    }
  };
  const handleCancelEnd = () => setConfirmEndOpen(false);

  const changeTrips = (delta) => {
    if (!isRunning) return;
    setTrips((t) => {
      const next = Math.max(0, t + delta);
      persistClock({ trips: next });
      lastActionRef.current = { type: "trip", delta };
      return next;
    });
  };

  const changePassengers = (delta) => {
    if (!isRunning) return;
    setPassengers((p) => {
      const next = Math.max(0, p + delta);
      persistClock({ passengers: next });
      lastActionRef.current = { type: "pax", delta };
      return next;
    });
  };

  const undoLast = () => {
    const last = lastActionRef.current;
    if (!isRunning || !last) return;
    if (last.type === "trip") changeTrips(-last.delta);
    if (last.type === "pax") changePassengers(-last.delta);
    lastActionRef.current = null;
  };

  const resetCurrent = () => {
    if (!isRunning) return;
    setTrips(0);
    setPassengers(0);
    persistClock({ trips: 0, passengers: 0 });
    lastActionRef.current = null;
  };

  const formatElapsed = useCallback((s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  }, []);

  const historyCols = useMemo(() => [
    {
      field: "startTime",
      headerName: "Start Time",
      width: 160,
      valueFormatter: ({ value }) => {
        const parsed = dayjs(value);
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

  const historyRows = useMemo(
    () => rows.filter((h) => h?.startTime),
    [rows],
  );
  const totalTrips = useMemo(() => rows.reduce((s, h) => s + (h.trips || 0), 0), [rows]);
  const totalPassengers = useMemo(() => rows.reduce((s, h) => s + (h.passengers || 0), 0), [rows]);
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
              sx={{ mb: 2 }}
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
                <IconButton color="primary" onClick={() => changeTrips(1)} size="small">
                  <AddIcon />
                </IconButton>
                <IconButton color="error" onClick={() => changeTrips(-1)} disabled={trips === 0} size="small">
                  <RemoveIcon />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="center">
                <PeopleIcon />
                <Typography>Passengers: {passengers}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <Button key={n} variant="outlined" size="small" onClick={() => changePassengers(n)}>
                      +{n}
                    </Button>
                  ))}
                </Box>
                <IconButton color="error" onClick={() => changePassengers(-1)} disabled={passengers === 0} size="small">
                  <RemoveIcon />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button onClick={undoLast} startIcon={<UndoIcon />} disabled={!lastActionRef.current}>
                  Undo
                </Button>
                <Button onClick={resetCurrent} startIcon={<RestartAltIcon />} disabled={!isRunning || (trips === 0 && passengers === 0)}>
                  Reset
                </Button>
              </Stack>
            </Stack>
          )}

          {rows.length > 0 && (
            <Box mt={3} textAlign="left">
              <Divider sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Recent Sessions
              </Typography>
              <DataGrid
                autoHeight
                rows={historyRows}
                columns={historyCols}
                getRowId={(r) => r.id || `${r.startTime?.valueOf?.()}_${r.endTime?.valueOf?.()}`}
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
            This will save the session to Firestore and reset the live counter.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEnd}>Cancel</Button>
          <Button onClick={handleConfirmEnd} color="error" variant="contained">
            End & Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(err)} onClose={() => setErr(null)} autoHideDuration={6000}>
        <Alert onClose={() => setErr(null)} severity="error" sx={{ width: '100%' }}>
          {err === 'permission-denied'
            ? "You don’t have permission to view this data. Ask an admin to grant access."
            : err}
        </Alert>
      </Snackbar>
    </Box>
  );
}
