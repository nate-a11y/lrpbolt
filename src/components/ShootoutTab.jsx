/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useRef, useState } from "react";
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

import { DataGridPro } from "@mui/x-data-grid-pro";
import useGridProDefaults from "./grid/useGridProDefaults.js";
import {
  subscribeShootoutStats,
  createShootoutSession,
  updateShootoutSession,
} from "../utils/firestoreService";
import { logError } from "../utils/logError";
import { currentUserEmailLower } from "../utils/userEmail";
import { toNumber, toString, tsToDate } from "../utils/safe";
import { fmtDuration } from "../utils/timeUtils";
import { safeRow } from '@/utils/gridUtils'
import { fmtDateTimeCell, fmtPlain, toJSDate, dateSort, warnMissingFields } from "@/utils/gridFormatters";
import DropoffDialog from "../components/DropoffDialog.jsx";
import CadillacEVQuickStarts from "../components/CadillacEVQuickStarts.jsx";
import { enqueueSms, watchMessage } from "../services/messaging.js";
import { resolveSmsTo } from "../services/smsRecipients.js";

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
  const [dropDialogOpen, setDropDialogOpen] = useState(false);
  const snackOpen = (m, s = "info") => setSnack({ open: true, msg: m, severity: s });
  const snackClose = () => setSnack((x) => ({ ...x, open: false }));
  const [tick, setTick] = useState(0);
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));
  const grid = useGridProDefaults({ gridId: "shootoutHistory", pageSize: 5 });
    const initialState = useMemo(
      () => ({
        ...grid.initialState,
        columns: {
          ...grid.initialState.columns,
          columnVisibilityModel: {
            vehicle: !isSmall,
            ...grid.initialState.columns.columnVisibilityModel,
          },
        },
      }),
      [grid.initialState, isSmall],
    );

    const cols = useMemo(
      () => [
        {
          field: "startTime",
          headerName: "Start",
          minWidth: 170,
          flex: 1,
          valueGetter: (p) => toJSDate(safeRow(p)?.start ?? safeRow(p)?.startTime),
          valueFormatter: fmtDateTimeCell("America/Chicago", "—"),
          sortComparator: dateSort,
        },
        {
          field: "endTime",
          headerName: "End",
          minWidth: 170,
          flex: 1,
          valueGetter: (p) => toJSDate(safeRow(p)?.end ?? safeRow(p)?.endTime),
          valueFormatter: fmtDateTimeCell("America/Chicago", "—"),
          sortComparator: dateSort,
        },
        {
          field: "duration",
          headerName: "Duration",
          width: 150,
          valueGetter: (p) => {
            const r = safeRow(p);
            return r
              ? { s: toJSDate(r.start ?? r.startTime), e: toJSDate(r.end ?? r.endTime) }
              : null;
          },
          valueFormatter: (params) =>
            params?.value ? fmtDuration(params.value.s, params.value.e) : "—",
          sortable: true,
        },
        { field: "trips", headerName: "Trips", width: 90, type: "number" },
        {
          field: "passengers",
          headerName: "Passengers",
          width: 120,
          type: "number",
        },
        {
          field: "vehicle",
          headerName: "Vehicle",
          minWidth: 120,
          flex: 1,
          valueFormatter: fmtPlain("—"),
        },
      ],
      [],
    );

    useEffect(() => {
      isMounted.current = true;
      if (authLoading || !driverEmail) return;

    const unsub = subscribeShootoutStats({
      driverEmail,
      onData: (rows) => {
        if (!isMounted.current) return;
          setHistory(rows);
          warnMissingFields(cols, rows);
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
    }, [authLoading, driverEmail, cols]);

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

  function onStopClick() {
    setDropDialogOpen(true);
  }

  async function stopCurrentSessionSafely() {
    if (!currentId) return;
    try {
      await updateShootoutSession(currentId, { endTime: new Date(), trips, passengers });
      setIsRunning(false);
    } catch (e) {
      logError("stopCurrentSessionSafely", e);
      throw e;
    }
  }

  async function finalizeStopAndMaybeSms(payload) {
    const { isDropoff, vehicleNumber, chargePercent, needsWash, needsInterior, issues } = payload;

    try {
      await stopCurrentSessionSafely();
    } catch (e) {
      snackOpen("Failed to stop session.", "error");
      return;
    }

    if (!isDropoff) {
      snackOpen("Session stopped.", "success");
      return;
    }

    const lines = [
      `Vehicle: #${vehicleNumber}`,
      `Charge %: ${chargePercent || "N/A"}`,
      `Needs Car Wash? ${needsWash ? "Y" : "N"}`,
      `Needs Interior Clean? ${needsInterior ? "Y" : "N"}`,
      `Issues: ${issues || "None"}`,
      `Reply STOP to opt out, HELP for help.`,
    ];
    const body = lines.join("\n");

    const to = await resolveSmsTo({ vehicleNumber });
    if (!to) {
      snackOpen("No SMS recipient configured (config/sms).", "error");
      return;
    }

    try {
      const ref = await enqueueSms({
        to,
        body,
        context: {
          source: "shootoutDropoff",
          vehicleNumber,
          needsWash,
          needsInterior,
          issues,
          actorEmail: user?.email || "unknown",
        },
      });

      snackOpen("Text queued…", "info");

      const unsub = watchMessage(ref, (d) => {
        if (d?.status === "sent") {
          snackOpen("Text sent ✅", "success");
          unsub();
        } else if (d?.status === "error") {
          snackOpen(`Text failed ❌: ${String(d.error).slice(0, 140)}`, "error");
          unsub();
        }
      });
    } catch (e) {
      snackOpen(`Queue failed: ${String(e?.message || e)}`, "error");
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
  const rows = useMemo(
    () =>
      history.map((h) => ({
        id: h.id,
        startTime: h.startTime,
        endTime: h.endTime,
        trips: toNumber(h.trips, 0),
        passengers: toNumber(h.passengers, 0),
        vehicle: toString(h.vehicle, ""),
      })),
    [history],
  );

    return (
      <Card sx={{ borderRadius: 3 }}>
      <CardHeader title="Shootout Tracker" />
      <CardContent>
        <Box sx={{ mb: 2 }}>
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
              onClick={onStopClick}
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
        </Box>

        <CadillacEVQuickStarts />

        <Box sx={{ mt: 2 }}>
          {/* History grid */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>History (latest first)</Typography>
          {isSmall ? (
            <Stack spacing={1}>
              {rows.map((r) => (
                <Paper key={r.id} variant="outlined" sx={{ p: 1 }}>
                  <Typography variant="body2">
                    Start: {fmtDateTime(r.startTime, "MMM D, h:mm A")}
                  </Typography>
                  <Typography variant="body2">
                    End: {fmtDateTime(r.endTime, "MMM D, h:mm A")}
                  </Typography>
                  <Typography variant="body2">
                    Duration: {fmtDuration(r.startTime, r.endTime)}
                  </Typography>
                  <Typography variant="body2">Trips: {r.trips}</Typography>
                  <Typography variant="body2">
                    Passengers: {r.passengers}
                  </Typography>
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
              <DataGridPro
                {...grid}
                rows={rows ?? []}
                columns={cols}
                pageSizeOptions={[5, 10, 25]}
                initialState={initialState}
                getRowId={(r) => r.id ?? r.rideId ?? r._id ?? `${r.pickupTime ?? r.start ?? 'row'}-${r.vehicle ?? ''}`}
              />
              {rows.length === 0 && (
                <Typography textAlign="center" color="text.secondary" mt={2}>
                  No sessions found.
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </CardContent>

      <DropoffDialog
        open={dropDialogOpen}
        onClose={() => setDropDialogOpen(false)}
        onSubmit={finalizeStopAndMaybeSms}
      />

      <Snackbar
        open={snack.open}
        onClose={snackClose}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={snackClose} severity={snack.severity} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Card>
  );
}
