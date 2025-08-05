/* Proprietary and confidential. See LICENSE. */
// src/components/BlackoutOverlay.jsx
import React, { useEffect, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { TIMEZONE } from "../constants";

dayjs.extend(utc);
dayjs.extend(timezone);

const CST = TIMEZONE;

const BlackoutOverlay = ({ isAdmin, isLocked, onUnlock }) => {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = dayjs().tz(CST);
      const unlockTime =
        now.hour() >= 20
          ? now.add(1, "day").hour(20).minute(0).second(0)
          : now.hour() >= 18
            ? now.hour(20).minute(0).second(0)
            : now;
      const diff = unlockTime.diff(now, "second");
      setSecondsLeft(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && typeof onUnlock === "function") {
      onUnlock();
    }
  }, [secondsLeft, onUnlock]);

  if (!isLocked || isAdmin) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <Box
      position="absolute"
      minHeight="300px"
      top={0}
      left={0}
      width="100%"
      height="100%"
      bgcolor="rgba(0,0,0,0.95)"
      zIndex={10}
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
      textAlign="center"
      sx={{ borderRadius: 2 }}
    >
      <LockIcon
        sx={{
          fontSize: 60,
          color: "warning.main",
          mb: 2,
          filter: "drop-shadow(0 0 6px lime)",
        }}
      />
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Ride Claim Locked
      </Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        Come back at <strong>8:00 PM</strong> local time to start claiming rides
        again.
      </Typography>
      <Button
        variant="outlined"
        color="success"
        startIcon={<HourglassBottomIcon />}
        sx={{ fontSize: "1.1rem", px: 3, py: 1, borderRadius: 2 }}
      >
        {mins}m {secs.toString().padStart(2, "0")}s
      </Button>
      <Typography variant="caption" mt={2} sx={{ color: "gray" }}>
        🕓 Debug Time: {dayjs().tz(CST).format("YYYY-MM-DD hh:mm:ss A")}
      </Typography>
    </Box>
  );
};

export default BlackoutOverlay;
