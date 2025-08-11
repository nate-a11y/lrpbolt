/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Stack,
  IconButton,
  Button,
  Divider,
  Snackbar,
  Alert,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import PeopleIcon from "@mui/icons-material/People";
import dayjs from "dayjs";
import { useDriver } from "../context/DriverContext.jsx";
import {
  subscribeShootoutStats,
  createShootoutSession,
  updateShootoutSession,
  tsToDate,
} from "../utils/firestoreService";
import { logError } from "../utils/logError";

export default function ShootoutTab() {
  const { driver } = useDriver();
  const driverEmail = driver?.email || driver?.driver?.email || "";
  const isMounted = useRef(true);

  const [currentId, setCurrentId] = useState(null);
  const [startTime, setStartTime] = useState(null); // Date | null
  const [isRunning, setIsRunning] = useState(false);
  const [trips, setTrips] = useState(0);
  const [passengers, setPassengers] = useState(0);
  const [vehicle, setVehicle] = useState("");
  const [history, setHistory] = useState([]);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  useEffect(() => {
    isMounted.current = true;
    const unsub = subscribeShootoutStats({
      driverEmail,
      onData: (rows) => {
        if (!isMounted.current) return;
        setHistory(rows);
        // Rehydrate current if there is an open session
        const open = rows.find((r) => r.driverEmail?.toLowerCase() === driverEmail?.toLowerCase() && !r.endTime);
        if (open) {
          setCurrentId(open.id);
          setStartTime(tsToDate(open.startTime));
          setIsRunning(Boolean(open.startTime && !open.endTime));
          setTrips(Number(open.trips || 0));
          setPassengers(Number(open.passengers || 0));
          setVehicle(open.vehicle || "");
        } else {
          // nothing open
          setCurrentId(null);
          setStartTime(null);
          setIsRunning(false);
          setTrips(0);
          setPassengers(0);
          setVehicle("");
        }
      },
      onError: (err) => {
        setSnack({ open: true, msg: "Permissions error loading shootout stats.", severity: "error" });
      },
    });
    return () => { isMounted.current = false; unsub && unsub(); };
  }, [driverEmail]);

  const elapsed = useMemo(() => {
    if (!startTime || !isRunning) return "00:00:00";
    const diff = dayjs().diff(dayjs(startTime), "second");
    const h = String(Math.floor(diff / 3600)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
    const s = String(diff % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [startTime, isRunning]);

  async function handleStart() {
    if (!driverEmail) {
      setSnack({ open: true, msg: "No driver email; cannot start.", severity: "error" });
      return;
    }
    try {
      if (currentId) {
        // already running
        return;
      }
      const id = await createShootoutSession({ driverEmail, vehicle, startTime: new Date() });
      setCurrentId(id);
      setStartTime(new Date());
      setIsRunning(true);
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

  async function inc(field, delta) {
    try {
      const next = field === "trips" ? Math.max(0, trips + delta) : Math.max(0, passengers + delta);
      field === "trips" ? setTrips(next) : setPassengers(next);
      if (currentId) await updateShootoutSession(currentId, { [field]: next });
    } catch (e) {
      logError("inc " + field, e);
    }
  }

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardHeader title="Shootout Tracker" />
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="h6">Elapsed: {elapsed}</Typography>
          <Button startIcon={<PlayArrowIcon />} variant="contained" onClick={handleStart} disabled={isRunning}>
            Start
          </Button>
          <Button startIcon={<StopIcon />} variant="outlined" color="error" onClick={handleStop} disabled={!isRunning}>
            Stop
          </Button>
          <Divider flexItem sx={{ mx: 2 }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <DirectionsCarIcon />
            <Typography variant="body2">{vehicle || "No vehicle"}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <PeopleIcon />
            <IconButton onClick={() => inc("passengers", -1)}><RemoveIcon /></IconButton>
            <Typography>{passengers}</Typography>
            <IconButton onClick={() => inc("passengers", +1)}><AddIcon /></IconButton>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography>Trips</Typography>
            <IconButton onClick={() => inc("trips", -1)}><RemoveIcon /></IconButton>
            <Typography>{trips}</Typography>
            <IconButton onClick={() => inc("trips", +1)}><AddIcon /></IconButton>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>History (latest first)</Typography>
        <Box sx={{ fontFamily: "monospace", fontSize: 12 }}>
          {history.map((h) => (
            <div key={h.id}>
              {dayjs(h.startTime).isValid() ? dayjs(h.startTime).format("YYYY-MM-DD HH:mm:ss") : "—"} → {h.endTime ? dayjs(h.endTime).format("HH:mm:ss") : "…"} | trips {h.trips ?? 0} | pax {h.passengers ?? 0}
            </div>
          ))}
        </Box>
      </CardContent>
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({...s, open:false}))}>
        <Alert severity={snack.severity} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Card>
  );
}

