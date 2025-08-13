/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Box, Card, CardContent, CardHeader, Typography, Stack, IconButton,
  Button, Divider, Snackbar, Alert, Chip, Paper, useMediaQuery,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import PeopleIcon from "@mui/icons-material/People";
import dayjs from "dayjs";
import durationPlugin from "dayjs/plugin/duration";
dayjs.extend(durationPlugin);

import { DataGrid } from "@mui/x-data-grid";
import {
  subscribeShootoutStats,
  createShootoutSession,
  updateShootoutSession,
} from "../utils/firestoreService";
import { logError } from "../utils/logError";
import { currentUserEmailLower } from "../utils/userEmail";
import { toNumber, toString, tsToDate } from "../utils/safe";

const VEHICLES = ["LYRIQ", "Escalade IQ", "OPTIQ", "CELESTIQ"];

export default function ShootoutTab() {
  const { user, authLoading } = useAuth();
  const driverEmail = currentUserEmailLower(user);
  const isMounted = useRef(true);

  const [currentId, setCurrentId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [trips, setTrips] = useState(0);
  const [passengers, setPassengers] = useState(0);
  const [vehicle, setVehicle] = useState("");
  const [history, setHistory] = useState([]);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
  const [tick, setTick] = useState(0);
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));

  useEffect(() => {
    isMounted.current = true;
    if (authLoading || !driverEmail) return;

    const unsub = subscribeShootoutStats({
      driverEmail,
      onData: (rows) => {
        if (!isMounted.current) return;
        setHistory(rows);
        const open = rows.find(
          (r) => r.driverEmail?.toLowerCase() === driverEmail?.toLowerCase() && !r.endTime
        );
        if (open) {
          const start = tsToDate(open.startTime);
          const end = tsToDate(open.endTime);
          setCurrentId(open.id);
          setStartTime(start);
          setIsRunning(Boolean(start && !end));
          setTrips(toNumber(open.trips, 0));
          setPassengers(toNumber(open.passengers, 0));
          setVehicle(toString(open.vehicle, "")); // rehydrate selection
          setTick(0);
        } else {
          setCurrentId(null);
          setStartTime(null);
          setIsRunning(false);
          setTrips(0);
          setPassengers(0);
          setVehicle("");
          setTick(0);
        }
      },
      onError: () => setSnack({ open: true, msg: "Permissions error loading shootout stats.", severity: "error" }),
    });

    return () => { isMounted.current = false; unsub && unsub(); };
  }, [authLoading, driverEmail]);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const elapsed = useMemo(() => {
    if (!startTime || !isRunning) return "00:00:00";
    const diff = dayjs().diff(dayjs(startTime), "second");
    const d = dayjs.duration(diff, "seconds");
    return [d.hours(), d.minutes(), d.seconds()].map((n) => String(n).padStart(2, "0")).join(":");
  }, [startTime, isRunning, tick]);

  async function handleStart() {
    if (authLoading || !driverEmail || currentId) return;
    if (!vehicle) {
      setSnack({ open: true, msg: "Select a vehicle to start.", severity: "warning" });
      return;
    }
    try {
      const id = await createShootoutSession({
        driverEmail,
        vehicle,                 // required
        startTime: new Date(),
        trips: 0,
        passengers: 0,
      });
      setCurrentId(id);
      setStartTime(new Date());
      setIsRunning(true);
      setTick(0);
      setSnack({ open: true, msg: "Session started.", severity: "success" });
    } catch (e) {
      logError("handleStart", e);
      setSnack({ open: true, msg: "Failed to start session.", severity: "error" });
    }
  }

  async function handleStop() {
    if (!currentId) return;
    try {
      await updateShootoutSession(currentId, { endTime: new Date(), trips, passengers });
      setIsRunning(false);
      setSnack({ open: true, msg: "Session stopped.", severity: "success" });
    } catch (e) {
      logError("handleStop", e);
      setSnack({ open: true, msg: "Failed to stop session.", severity: "error" });
    }
  }

  async function addPaxAndTrip(n) {
    if (!isRunning || !currentId) return;
    const nextPax = Math.max(0, passengers + n);
    const nextTrips = trips + 1;
    setPassengers(nextPax);
    setTrips(nextTrips);
    try {
      await updateShootoutSession(currentId, { passengers: nextPax, trips: nextTrips });
    } catch (e) {
      // optimistic rollback
      setPassengers(passengers);
      setTrips(trips);
      logError("addPaxAndTrip", e);
      setSnack({ open: true, msg: "Failed to update. Check connection.", severity: "error" });
    }
  }

  async function inc(field, delta) {
    if (!isRunning || !currentId) return;
    const next = field === "trips" ? Math.max(0, trips + delta) : Math.max(0, passengers + delta);
    field === "trips" ? setTrips(next) : setPassengers(next);
    try { await updateShootoutSession(currentId, { [field]: next }); } catch (e) { logError("inc "+field, e); }
  }

  // History grid
  const rows = useMemo(() =>
    history.map((h) => {
      const st = tsToDate(h.startTime);
      const et = tsToDate(h.endTime);
      const durMin = st && et ? Math.max(0, Math.round((new Date(et) - new Date(st)) / 60000)) : null;
      return {
        id: h.id,
        start: st ? new Date(st).toLocaleString() : "—",
        end: et ? new Date(et).toLocaleString() : "—",
        duration: durMin ?? "—",
        trips: toNumber(h.trips, 0),
        pax: toNumber(h.passengers, 0),
        vehicle: toString(h.vehicle, ""),
      };
    }), [history]
  );

  const cols = [
    { field: "start", headerName: "Start", minWidth: 170, flex: 1 },
    { field: "end", headerName: "End", minWidth: 170, flex: 1 },
    { field: "duration", headerName: "Duration (min)", width: 150, type: "number" },
    { field: "trips", headerName: "Trips", width: 90, type: "number" },
    { field: "pax", headerName: "Passengers", width: 120, type: "number" },
    { field: "vehicle", headerName: "Vehicle", minWidth: 120, flex: 1 },
  ];

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardHeader title="Shootout Tracker" />
      <CardContent>
        {/* Step 1: Select Vehicle */}
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ mr: 1 }}>Select Vehicle</Typography>
          {VEHICLES.map((v) => {
            const selected = vehicle === v;
            return (
              <Chip
                key={v}
                label={v}
                clickable
                onClick={() => !isRunning && setVehicle(v)}
                color={selected ? "primary" : "default"}
                variant={selected ? "filled" : "outlined"}
                sx={{ fontWeight: 700 }}
                disabled={isRunning} // lock while running
              />
            );
          })}
        </Stack>

        {/* Step 2: Start / Stop */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          flexWrap="wrap"
        >
          <Typography variant="h6">Elapsed: {elapsed}</Typography>

          <Button
            startIcon={<PlayArrowIcon />}
            variant="contained"
            onClick={handleStart}
            disabled={isRunning || !vehicle}              // require vehicle
          >
            Start
          </Button>
          <Button
            startIcon={<StopIcon />}
            variant="outlined"
            color="error"
            onClick={handleStop}
            disabled={!isRunning}
          >
            Stop
          </Button>

          <Divider
            flexItem
            orientation={isSmall ? "horizontal" : "vertical"}
            sx={{ mx: isSmall ? 0 : 2, my: isSmall ? 2 : 0 }}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <DirectionsCarIcon />
            <Typography variant="body2">{vehicle || "No vehicle"}</Typography>
          </Stack>

          {/* Step 3: Passenger quick-add (also +1 trip) */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ ml: isSmall ? 0 : 1 }}
          >
            <PeopleIcon sx={{ opacity: 0.7 }} />
            {[1,2,3,4,5,6,7].map((n) => (
              <Chip
                key={n}
                label={n}
                clickable
                disabled={!isRunning}
                onClick={() => addPaxAndTrip(n)}
                sx={{ fontWeight: 700 }}
              />
            ))}
          </Stack>

          {/* Manual adjust (optional) */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ ml: { sm: "auto" } }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography>Passengers</Typography>
              <IconButton onClick={() => inc("passengers", -1)} disabled={!isRunning}><RemoveIcon /></IconButton>
              <Typography>{passengers}</Typography>
              <IconButton onClick={() => inc("passengers", +1)} disabled={!isRunning}><AddIcon /></IconButton>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography>Trips</Typography>
              <IconButton onClick={() => inc("trips", -1)} disabled={!isRunning}><RemoveIcon /></IconButton>
              <Typography>{trips}</Typography>
              <IconButton onClick={() => inc("trips", +1)} disabled={!isRunning}><AddIcon /></IconButton>
            </Stack>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* History grid */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>History (latest first)</Typography>
        {isSmall ? (
          <Stack spacing={1}>
            {rows.map((r) => (
              <Paper key={r.id} variant="outlined" sx={{ p: 1 }}>
                <Typography variant="body2">Start: {r.start}</Typography>
                <Typography variant="body2">End: {r.end}</Typography>
                <Typography variant="body2">Duration: {r.duration}</Typography>
                <Typography variant="body2">Trips: {r.trips}</Typography>
                <Typography variant="body2">Passengers: {r.pax}</Typography>
                <Typography variant="body2">Vehicle: {r.vehicle}</Typography>
              </Paper>
            ))}
            {rows.length === 0 && (
              <Typography textAlign="center" color="text.secondary" mt={2}>
                No sessions found.
              </Typography>
            )}
          </Stack>
        ) : (
          <Box sx={{ width: "100%" }}>
            <DataGrid
              autoHeight
              rows={rows}
              columns={cols}
              density="compact"
              pageSizeOptions={[5, 10, 25]}
              initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
              disableRowSelectionOnClick
            />
            {rows.length === 0 && (
              <Typography textAlign="center" color="text.secondary" mt={2}>
                No sessions found.
              </Typography>
            )}
          </Box>
        )}
      </CardContent>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Card>
  );
}
