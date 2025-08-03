/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Stack,
  IconButton,
  Button,
  Fab,
  Divider,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PeopleIcon from '@mui/icons-material/People';
import dayjs from 'dayjs';

export default function CadillacTab() {
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trips, setTrips] = useState(0);
  const [passengers, setPassengers] = useState(0);
  const [history, setHistory] = useState([]);

  // load from storage on mount
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('cadillacClock') || '{}');
    if (stored.startTime) {
      const start = dayjs(stored.startTime);
      setStartTime(start);
      setIsRunning(true);
      setTrips(stored.trips || 0);
      setPassengers(stored.passengers || 0);
      setElapsed(dayjs().diff(start, 'second'));
    }
    const storedHistory = JSON.parse(
      localStorage.getItem('cadillacHistory') || '[]'
    ).map((h) => ({
      ...h,
      duration:
        h.duration ?? dayjs(h.endTime).diff(dayjs(h.startTime), 'second'),
    }));
    setHistory(storedHistory);
  }, []);

  // timer effect
  useEffect(() => {
    let interval;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsed(dayjs().diff(startTime, 'second'));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // persist clock details whenever they change
  useEffect(() => {
    if (isRunning && startTime) {
      localStorage.setItem(
        'cadillacClock',
        JSON.stringify({
          startTime: startTime.toISOString(),
          trips,
          passengers,
        })
      );
    }
  }, [isRunning, startTime, trips, passengers]);

  const handleStart = () => {
    const now = dayjs();
    setStartTime(now);
    setIsRunning(true);
    setTrips(0);
    setPassengers(0);
    setElapsed(0);
    localStorage.setItem(
      'cadillacClock',
      JSON.stringify({ startTime: now.toISOString(), trips: 0, passengers: 0 })
    );
  };

  const handleEnd = () => {
    const endTime = dayjs();
    const duration = endTime.diff(startTime, 'second');
    const newEntry = {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      trips,
      passengers,
      duration,
    };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('cadillacHistory', JSON.stringify(updatedHistory));
    setIsRunning(false);
    setStartTime(null);
    setElapsed(0);
    localStorage.removeItem('cadillacClock');
  };

  const changeTrips = (delta) => {
    if (!isRunning) return;
    setTrips((t) => Math.max(0, t + delta));
  };

  const changePassengers = (delta) => {
    if (!isRunning) return;
    setPassengers((p) => Math.max(0, p + delta));
  };

  const formatElapsed = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs ? `${hrs}h ` : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const historyRows = useMemo(
    () =>
      history.map((h) => ({
        id: h.startTime,
        ...h,
        duration:
          h.duration ??
          dayjs(h.endTime).diff(dayjs(h.startTime), 'second'),
      })),
    [history]
  );

  const historyCols = [
    {
      field: 'startTime',
      headerName: 'Start',
      width: 150,
      valueFormatter: ({ value }) => dayjs(value).format('M/D HH:mm'),
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 130,
      valueFormatter: ({ value }) => formatElapsed(value),
    },
    { field: 'trips', headerName: 'Trips', width: 80 },
    { field: 'passengers', headerName: 'Passengers', width: 130 },
  ];

  const totalTrips = useMemo(
    () => history.reduce((s, h) => s + h.trips, 0),
    [history]
  );
  const totalPassengers = useMemo(
    () => history.reduce((s, h) => s + h.passengers, 0),
    [history]
  );
  const avgPassengers = totalTrips
    ? (totalPassengers / totalTrips).toFixed(2)
    : 0;

  return (
    <Box maxWidth={500} mx="auto">
      <Card sx={{ borderLeft: '5px solid #4cbb17' }}>
        <CardHeader title="Cadillac Time Tracker" sx={{ textAlign: 'center' }} />
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="h3" gutterBottom>
            {formatElapsed(elapsed)}
          </Typography>
          {isRunning ? (
            <Fab color="error" onClick={handleEnd} sx={{ mb: 2 }}>
              <StopIcon />
            </Fab>
          ) : (
            <Fab color="success" onClick={handleStart} sx={{ mb: 2 }}>
              <PlayArrowIcon />
            </Fab>
          )}

          {isRunning && (
            <Stack spacing={3} direction="column" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <DirectionsCarIcon />
                <Typography>Trips: {trips}</Typography>
                <IconButton color="primary" onClick={() => changeTrips(1)} size="small">
                  <AddIcon />
                </IconButton>
                <IconButton
                  color="error"
                  onClick={() => changeTrips(-1)}
                  disabled={trips === 0}
                  size="small"
                >
                  <RemoveIcon />
                </IconButton>
              </Stack>
              <Stack spacing={1} alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <PeopleIcon />
                  <Typography>Passengers: {passengers}</Typography>
                  <IconButton
                    color="error"
                    onClick={() => changePassengers(-1)}
                    disabled={passengers === 0}
                    size="small"
                  >
                    <RemoveIcon />
                  </IconButton>
                </Stack>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <Button
                      key={n}
                      variant="outlined"
                      size="small"
                      onClick={() => changePassengers(n)}
                    >
                      +{n}
                    </Button>
                  ))}
                </Box>
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
                hideFooter
                disableRowSelectionOnClick
              />
              <Typography variant="subtitle1" mt={1}>
                Total Trips: {totalTrips}, Total Passengers: {totalPassengers},
                Passengers/Trip: {avgPassengers}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

