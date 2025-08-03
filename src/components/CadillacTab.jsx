/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';
import dayjs from 'dayjs';

export default function CadillacTab() {
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trips, setTrips] = useState(0);
  const [passengers, setPassengers] = useState(0);

  // load from storage on mount
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('cadillacClock') || '{}');
    if (stored.startTime) {
      setStartTime(dayjs(stored.startTime));
      setIsRunning(true);
      setTrips(stored.trips || 0);
      setPassengers(stored.passengers || 0);
    }
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

  const handleStart = () => {
    const now = dayjs();
    setStartTime(now);
    setIsRunning(true);
    setTrips(0);
    setPassengers(0);
    localStorage.setItem('cadillacClock', JSON.stringify({
      startTime: now.toISOString(),
      trips: 0,
      passengers: 0,
    }));
  };

  const handleEnd = () => {
    setIsRunning(false);
    setStartTime(null);
    setElapsed(0);
    localStorage.removeItem('cadillacClock');
  };

  const incrementTrips = () => {
    if (!isRunning) return;
    setTrips((t) => {
      const next = t + 1;
      const store = JSON.parse(localStorage.getItem('cadillacClock') || '{}');
      localStorage.setItem('cadillacClock', JSON.stringify({
        ...store,
        trips: next,
      }));
      return next;
    });
  };

  const incrementPassengers = () => {
    if (!isRunning) return;
    setPassengers((p) => {
      const next = p + 1;
      const store = JSON.parse(localStorage.getItem('cadillacClock') || '{}');
      localStorage.setItem('cadillacClock', JSON.stringify({
        ...store,
        passengers: next,
      }));
      return next;
    });
  };

  const formatElapsed = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    };

  return (
    <Box maxWidth={400} mx="auto">
      <Paper sx={{ p: 3, textAlign: 'center', borderLeft: '5px solid #4cbb17' }}>
        <Typography variant="h6" gutterBottom>Cadillac Time Tracker</Typography>
        <Typography variant="h4" gutterBottom>
          {formatElapsed(elapsed)}
        </Typography>
        {isRunning ? (
          <Button variant="contained" color="error" onClick={handleEnd} sx={{ mb: 2 }}>
            End
          </Button>
        ) : (
          <Button variant="contained" color="success" onClick={handleStart} sx={{ mb: 2 }}>
            Start
          </Button>
        )}

        {isRunning && (
          <Stack spacing={2} direction="column" alignItems="center">
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography>Trips: {trips}</Typography>
              <Button variant="outlined" onClick={incrementTrips}>Add Trip</Button>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography>Passengers: {passengers}</Typography>
              <Button variant="outlined" onClick={incrementPassengers}>Add Passenger</Button>
            </Stack>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}

