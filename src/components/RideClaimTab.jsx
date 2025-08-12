/* Proprietary and confidential. See LICENSE. */
// src/components/RideClaimTab.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import RideGroup from "../RideGroup";
import BlackoutOverlay from "./BlackoutOverlay";
import { claimRideAtomic } from "../hooks/api";
import useFirestoreListener from "../hooks/useFirestoreListener";
import { fmtDow, safe, groupKey } from "../utils/rideFormatters";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { TIMEZONE, COLLECTIONS } from "../constants";
import { Timestamp, orderBy } from "firebase/firestore";

dayjs.extend(utc);
dayjs.extend(timezone);
const CST = TIMEZONE;

const RideClaimTab = ({ driver, isAdmin = true, isLockedOut = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [rides, setRides] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [claimLog, setClaimLog] = useState([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [selectedRides, setSelectedRides] = useState(new Set());

  const groupedRides = useMemo(() => {
    const grouped = {};
    for (const r of rides) {
      const key = `${safe(r.vehicle)}___${fmtDow(r.pickupTime)}___${groupKey(
        r.pickupTime,
      )}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    return grouped;
  }, [rides]);

  const uniqueVehicles = useMemo(
    () => Array.from(new Set(rides.map((r) => r.vehicle))),
    [rides],
  );

  const showToast = (message, severity = "success") =>
    setToast({ open: true, message, severity });

  const toggleRideSelection = useCallback((id) => {
    setSelectedRides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleGroupSelection = useCallback((ids) => {
    setSelectedRides((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }, []);

  const clearSelections = useCallback((ids) => {
    setSelectedRides((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Requires Firestore index: Firestore Database > Indexes > liveRides.pickupTime ASC
  const rideQuery = useMemo(() => [orderBy("pickupTime", "asc")], []);
  const liveRides = useFirestoreListener(COLLECTIONS.LIVE_RIDES, rideQuery);

  // ✅ Update rides from shared hook
  useEffect(() => {
    if (driver && !isLockedOut) {
      setRides(liveRides);
      setLoadingRides(false);
    }
  }, [driver, isLockedOut, liveRides]);

  const claimRide = useCallback(
    async (tripId) => {
      const ride = rides.find((r) => r.tripId === tripId || r.id === tripId);
      if (!ride) throw new Error("Ride not found");

      const pickupTime =
        ride.pickupTime instanceof Timestamp
          ? ride.pickupTime
          : Timestamp.fromDate(new Date(ride.pickupTime));

      await claimRideAtomic(ride.id || ride.tripId, driver, {
        pickupTime,
        rideDuration: Number(ride.rideDuration ?? 0),
      });

      setClaimLog((prev) => [
        ...prev,
        { tripId, time: new Date().toLocaleTimeString() },
      ]);
      return true;
    },
    [rides, driver],
  );

  return (
    <Box position="relative">
      {isLockedOut && (
        <BlackoutOverlay
          isAdmin={isAdmin}
          isLocked={isLockedOut}
          onUnlock={() => showToast("🔥 Real-time updates active", "info")}
        />
      )}

      <Box
        display="flex"
        gap={2}
        mb={3}
        flexDirection={isMobile ? "column" : "row"}
        alignItems={isMobile ? "stretch" : "center"}
      >
        <TextField
          select
          label="Day"
          size="small"
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CalendarTodayIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 160, flex: isMobile ? 1 : "inherit" }}
        >
          <MenuItem value="">All</MenuItem>
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Vehicle"
          size="small"
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <DirectionsCarIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 160, flex: isMobile ? 1 : "inherit" }}
        >
          <MenuItem value="">All</MenuItem>
          {uniqueVehicles.map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>

        <Button
          variant="outlined"
          color="primary"
          startIcon={
          loadingRides ? <CircularProgress size={16} /> : <RefreshIcon />
          }
          onClick={() =>
            showToast("🔥 Real-time updates active", "info")
          }
          disabled={loadingRides}
          sx={{ alignSelf: isMobile ? "stretch" : "center" }}
        >
          Refresh
        </Button>
      </Box>

      {loadingRides ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight={200}
        >
          <Typography variant="body1" color="text.secondary" mr={2}>
            Loading rides...
          </Typography>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          {Object.entries(groupedRides).map(([gKey, rides]) => {
            const [vehicle, day] = gKey.split("___");
            if (
              (vehicleFilter && vehicle !== vehicleFilter) ||
              (dayFilter && day !== dayFilter)
            )
              return null;

            return (
              <RideGroup
                key={gKey}
                groupKey={gKey}
                rides={rides}
                onClaim={claimRide}
                showToast={showToast}
                selectedRides={selectedRides}
                onToggleSelect={toggleRideSelection}
                onGroupToggle={toggleGroupSelection}
                onClearSelected={clearSelections}
              />
            );
          })}

          {Object.keys(groupedRides).length === 0 && (
            <Typography
              variant="body1"
              color="text.secondary"
              textAlign="center"
              mt={5}
            >
              🚫 No unclaimed rides available right now.
            </Typography>
          )}
        </>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert severity={toast.severity} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RideClaimTab;
