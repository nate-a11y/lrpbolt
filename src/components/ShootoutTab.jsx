import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  collection, doc, setDoc, onSnapshot, query, orderBy, limit
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Timestamp } from "firebase/firestore";

const SHOOTOUT_COL = "shootoutStats";

export default function ShootoutTab() {
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trips, setTrips] = useState(0);
  const [passengers, setPassengers] = useState(0);
  const [history, setHistory] = useState([]);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const intervalRef = useRef(null);
  const lastActionRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, SHOOTOUT_COL), orderBy("startTime", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isRunning && startTime) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.toMillis()) / 1000));
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, startTime]);

  const handleStart = () => {
    const now = Timestamp.now();
    setStartTime(now);
    setIsRunning(true);
    setTrips(0);
    setPassengers(0);
    setElapsed(0);
  };

  const finalizeSession = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    const now = Timestamp.now();

    const end = Timestamp.now();
    const duration = Math.floor((end.toMillis() - startTime.toMillis()) / 1000);
    const newEntry = {
      startTime,
      endTime: end,
      createdAt: now,
      duration,
      trips,
      passengers,
      v: 1,
      createdBy: (user?.email || "unknown").toLowerCase(),
      createdByUid: user?.uid || "",
      eventKey: "shootout-2025"
    };
    const docId = `${startTime.toMillis()}_${end.toMillis()}`;
    await setDoc(doc(db, SHOOTOUT_COL, docId), newEntry, { merge: true });

    setIsRunning(false);
    setStartTime(null);
    setElapsed(0);
    setTrips(0);
    setPassengers(0);
  };

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec.toString().padStart(2, "0")}s`;
  };

  const columns = useMemo(() => [
    {
      field: "startTime",
      headerName: "Start Time",
      width: 160,
      valueFormatter: ({ value }) => dayjs(value?.toDate?.()).format("MM/DD HH:mm")
    },
    {
      field: "duration",
      headerName: "Duration",
      width: 120,
      valueFormatter: ({ value }) => formatElapsed(value)
    },
    { field: "trips", headerName: "Trips", width: 100 },
    { field: "passengers", headerName: "Passengers", width: 130 }
  ], []);

  return (
    <Box>
      <Card>
        <CardHeader title="Shootout Tracker" />
        <CardContent>
          <Typography variant="h4">{formatElapsed(elapsed)}</Typography>
          {!isRunning ? (
            <Fab color="primary" onClick={handleStart}><PlayArrowIcon /></Fab>
          ) : (
            <Stack spacing={2}>
              <Fab color="error" onClick={() => setConfirmEndOpen(true)}><StopIcon /></Fab>
              <Stack direction="row" spacing={1}>
                <Typography>Trips: {trips}</Typography>
                <IconButton onClick={() => setTrips(t => t + 1)}><AddIcon /></IconButton>
                <IconButton onClick={() => setTrips(t => Math.max(0, t - 1))}><RemoveIcon /></IconButton>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Typography>Passengers: {passengers}</Typography>
                <IconButton onClick={() => setPassengers(p => p + 1)}><AddIcon /></IconButton>
                <IconButton onClick={() => setPassengers(p => Math.max(0, p - 1))}><RemoveIcon /></IconButton>
              </Stack>
            </Stack>
          )}
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6">Recent Sessions</Typography>
          <DataGrid
            autoHeight
            rows={history}
            columns={columns}
            getRowId={(row) => row.id}
            hideFooter
          />
        </CardContent>
      </Card>
      <Dialog open={confirmEndOpen} onClose={() => setConfirmEndOpen(false)}>
        <DialogTitle>End Session?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmEndOpen(false)}>Cancel</Button>
          <Button color="error" onClick={() => {
            setConfirmEndOpen(false);
            finalizeSession();
          }}>End & Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
