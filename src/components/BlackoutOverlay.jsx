/* Proprietary and confidential. See LICENSE. */
// src/components/BlackoutOverlay.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography, Button, Fade, CircularProgress } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { TIMEZONE } from "../constants";

dayjs.extend(utc);
dayjs.extend(timezone);

const CST = TIMEZONE; // e.g., "America/Chicago"
export const BLACKOUT_START_HOUR = 19; // 7 PM
export const BLACKOUT_END_HOUR = 20; // 8 PM
const WINDOW_SECONDS = (BLACKOUT_END_HOUR - BLACKOUT_START_HOUR) * 3600; // 3600

/**
 * Props:
 * - isAdmin?: boolean         // bypass overlay
 * - isLocked?: boolean        // optional external lock; if omitted, lock is computed by time window
 * - onUnlock?: () => void     // callback when countdown hits zero
 */
export default function BlackoutOverlay({
  isAdmin = false,
  isLocked,
  onUnlock,
}) {
  const [now, setNow] = useState(() => dayjs().tz(CST));
  const [secondsLeft, setSecondsLeft] = useState(0);
  const prevSecondsRef = useRef(0);

  // Tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs().tz(CST)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute if we are within the blackout window, and seconds remaining to 8 PM
  const { withinBlackout, untilEndSeconds } = useMemo(() => {
    const h = now.hour();
    if (h >= BLACKOUT_START_HOUR && h < BLACKOUT_END_HOUR) {
      const unlockAt = now
        .hour(BLACKOUT_END_HOUR)
        .minute(0)
        .second(0)
        .millisecond(0);
      const diffSec = Math.max(0, unlockAt.diff(now, "second"));
      return { withinBlackout: true, untilEndSeconds: diffSec };
    }
    return { withinBlackout: false, untilEndSeconds: 0 };
  }, [now]);

  const effectiveLocked =
    !isAdmin && (typeof isLocked === "boolean" ? isLocked : withinBlackout);

  // Track seconds and fire onUnlock once when it flips to 0
  useEffect(() => {
    const next = effectiveLocked ? untilEndSeconds : 0;
    prevSecondsRef.current = secondsLeft;
    setSecondsLeft(next);

    if (
      prevSecondsRef.current > 0 &&
      next === 0 &&
      typeof onUnlock === "function"
    ) {
      onUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLocked, untilEndSeconds]);

  if (!effectiveLocked) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  // Progress ring (100% at start of window → 0% at 8 PM)
  const progressValue =
    WINDOW_SECONDS > 0 ? (secondsLeft / WINDOW_SECONDS) * 100 : 0;

  return (
    <Fade in timeout={200}>
      <Box
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        zIndex={10}
        display="flex"
        alignItems="center"
        justifyContent="center"
        sx={{
          borderRadius: 2,
          backdropFilter: "blur(6px)",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.60)",
          color: (t) => t.palette.getContrastText(t.palette.background.default),
          p: 2,
          pointerEvents: "none",
        }}
      >
        <Box sx={{ pointerEvents: "auto" }}>
          <Box
            sx={{
              width: "min(540px, 92vw)",
              textAlign: "center",
              p: 3,
              borderRadius: 3,
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(18,18,18,0.85)"
                  : "rgba(255,255,255,0.12)",
              boxShadow: (t) =>
                t.palette.mode === "dark"
                  ? "0 10px 30px rgba(0,0,0,0.6)"
                  : "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <LockIcon
              sx={{
                fontSize: 64,
                mb: 1,
                color: (t) => t.palette.warning.main,
                filter: "drop-shadow(0 0 8px rgba(255,193,7,0.7))",
              }}
            />
            <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
              Ride Claim Locked
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mb: 2 }}>
              Blackout window is active from <strong>7:00 PM</strong> to{" "}
              <strong>8:00 PM</strong> (Central).
            </Typography>

            <Box
              sx={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 2,
              }}
            >
              <CircularProgress
                variant="determinate"
                value={Math.max(0, Math.min(100, progressValue))}
                size={120}
                thickness={4.2}
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: "absolute",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <Typography variant="h6" component="div" fontWeight={800}>
                  {mins}:{secs.toString().padStart(2, "0")}
                </Typography>
              </Box>
            </Box>

            <Button
              variant="outlined"
              color="success"
              startIcon={<HourglassBottomIcon />}
              disabled
              sx={{ borderRadius: 2, px: 2.5, py: 1 }}
            >
              Unlocks at 8:00 PM (CT)
            </Button>

            {import.meta.env.MODE !== "production" && (
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 2, opacity: 0.7 }}
              >
                Debug: {now.format("YYYY-MM-DD hh:mm:ss A")} ({CST})
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Fade>
  );
}
