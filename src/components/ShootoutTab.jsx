/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useMemo } from "react";
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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import PeopleIcon from "@mui/icons-material/People";
import dayjs from "dayjs";

export default function ShootoutTab() {
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [trips, setTrips] = useState(0);
  const [passengers, setPassengers] = useState(0);
  const [history, setHistory] = useState([]);

  // Load from storage on mount
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("shootoutClock") || "{}");
    if (stored.startTime) {
      const start = dayjs(stored.startTime);
      setStartTime(start);
      setIsRunning(true);
      setTrips(stored.trips || 0);
      setPassengers(stored.passengers || 0);
      setElapsed(dayjs().diff(start, "second"));
    }
    const storedHistory = JSON.parse(
      localStorage.getItem("shootoutHistory") || "[]",
    ).map((h) => ({
      ...h,
      duration: Number.isFinite(h.duration)
        ? h.duration
        : h.endTime && h.startTime
          ? dayjs(h.endTime).diff(dayjs(h.startTime), "second")
          : 0,
    }));
    setHistory(storedHistory);
  }, []);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsed(dayjs().diff(startTime, "second"));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Persist clock details
  useEffect(() => {
    if (isRunning && startTime) {
      localStorage.setItem(
        "shootoutClock",
        JSON.stringify({
          startTime: startTime.toISOString(),
          trips,
          passengers,
        }),
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
      "shootoutClock",
      JSON.stringify({ startTime: now.toISOString(), trips: 0, passengers: 0 }),
    );
  };

  const handleEnd = () => {
    const endTime = dayjs();
    const duration = endTime.diff(startTime, "second");
    const newEntry = {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      trips,
      passengers,
      duration,
    };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("shootoutHistory", JSON.stringify(updatedHistory));
    setIsRunning(false);
    setStartTime(null);
    setElapsed(0);
    localStorage.removeItem("shootoutClock");
  };

  const changeTrips = (delta) => {
    if (!isRunning) return;
    setTrips((t) => {
      const next = Math.max(0, t + delta);
      const store = JSON.parse(localStorage.getItem("shootoutClock") || "{}");
      localStorage.setItem(
        "shootoutClock",
        JSON.stringify({ ...store, trips: next }),
      );
      return next;
    });
  };

  const changePassengers = (delta) => {
    if (!isRunning) return;
    setPassengers((p) => {
      const next = Math.max(0, p + delta);
      const store = JSON.parse(localStorage.getItem("shootoutClock") || "{}");
      localStorage.setItem(
        "shootoutClock",
        JSON.stringify({ ...store, passengers: next }),
      );
      return next;
    });
    changeTrips(delta > 0 ? 1 : -1);
  };

  const formatElapsed = (seconds) => {
    if (!Number.isFinite(seconds)) return "0m 00s";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs ? `${hrs}h ` : ""}${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  const historyRows = useMemo(
    () =>
      history.map((h) => {
        const duration =
          h.duration ??
          (h.endTime && h.startTime
            ? dayjs(h.endTime).diff(dayjs(h.startTime), "second")
            : 0);
        return { id: h.startTime, ...h, duration };
      }),
    [history],
  );

  const historyCols = [
    {
      field: "startTime",
      headerName: "Start",
      width: 150,
      valueFormatter: ({ value }) => dayjs(value).format("MM/DD HH:mm"),
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
      width: 80,
      align: "right",
      headerAlign: "right",
    },
    { field: "passengers", headerName: "Passengers", width: 130 },
  ];

  const totalTrips = useMemo(
    () => history.reduce((s, h) => s + h.trips, 0),
    [history],
  );
  const totalPassengers = useMemo(
    () => history.reduce((s, h) => s + h.passengers, 0),
    [history],
  );
  const avgPassengers = totalTrips
    ? (totalPassengers / totalTrips).toFixed(2)
    : 0;

  return (
    <Box maxWidth={500} mx="auto">
      <Card sx={{ borderLeft: "5px solid #4cbb17" }}>
        <CardHeader
          title="Shootout Ride & Time Tracker"
          subheader={
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              flexWrap="wrap"
              gap={1.5}
              mt={2}
            >
              <img
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSuQVpBIwemQ40C8l6cpz3508Vxrk2HaWmMNQ&s"
                alt="Shootout Logo"
                style={{ height: 40, width: "auto", objectFit: "contain" }}
              />
              <img
                src="https://logos-world.net/wp-content/uploads/2021/05/Cadillac-Logo.png"
                alt="Cadillac Logo"
                style={{ height: 40, width: "auto", objectFit: "contain" }}
              />
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
            <Typography
              variant="h3"
              sx={{ fontSize: { xs: "2.5rem", sm: "3rem", md: "3.5rem" } }}
            >
              {formatElapsed(elapsed)}
            </Typography>
          </Box>
          {isRunning ? (
            <Fab color="error" onClick={handleEnd} sx={{ mb: 2 }}>
              <StopIcon />
            </Fab>
          ) : (
            <Fab
              color="success"
              onClick={handleStart}
              sx={{ mb: 2, "&:active": { transform: "scale(0.95)" } }}
              centerRipple
            >
              <PlayArrowIcon />
            </Fab>
          )}

          {isRunning && (
            <Stack spacing={3} direction="column" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <DirectionsCarIcon />
                <Typography>Trips: {trips}</Typography>
                <IconButton
                  color="primary"
                  onClick={() => changeTrips(1)}
                  size="small"
                >
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
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
              >
                <PeopleIcon />
                <Typography>Passengers: {passengers}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
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
                <IconButton
                  color="error"
                  onClick={() => changePassengers(-1)}
                  disabled={passengers === 0}
                  size="small"
                >
                  <RemoveIcon />
                </IconButton>
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
                sx={{
                  "& .MuiDataGrid-columnHeaderTitle": { fontWeight: "bold" },
                  "& .MuiDataGrid-row:nth-of-type(odd)": {
                    backgroundColor: (theme) => theme.palette.action.hover,
                  },
                }}
              />
              <Stack spacing={0.5} mt={1}>
                <Typography>
                  <b>Total Trips:</b> {totalTrips}
                </Typography>
                <Typography>
                  <b>Total Passengers:</b> {totalPassengers}
                </Typography>
                <Typography>
                  <b>Passengers/Trip:</b> {avgPassengers}
                </Typography>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
