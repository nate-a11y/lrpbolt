/* Proprietary and confidential. See LICENSE. */
import { useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Fade,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PictureInPictureAltIcon from "@mui/icons-material/PictureInPictureAlt";
import CloseIcon from "@mui/icons-material/Close";

import { ActiveClockContext } from "@/context/ActiveClockContext.jsx";
import useElapsedFromTs from "@/hooks/useElapsedFromTs.js";
import { openTimeClockModal } from "@/services/uiBus";
import {
  requestPersistentClockNotification,
  clearClockNotification,
} from "@/pwa/clockNotifications";
import { trySetAppBadge, clearAppBadge } from "@/pwa/appBadge";
import useWakeLock from "@/hooks/useWakeLock.js";
import {
  startClockPiP,
  stopClockPiP,
  isPiPSupported,
  isPiPActive,
  updateClockPiP,
} from "@/pwa/pipTicker";
import { formatClockElapsed } from "@/utils/timeUtils.js";
import logError from "@/utils/logError.js";

const LRP = { green: "#4cbb17", black: "#060606" };

export default function TimeClockBubble() {
  const { hasActive, startTimeTs } = useContext(ActiveClockContext);
  const { start, elapsedMs } = useElapsedFromTs(startTimeTs);
  // Keep screen awake only while actually on the clock
  useWakeLock(hasActive && !!start);
  const [collapsed, setCollapsed] = useState(false);
  const [pipOn, setPipOn] = useState(false);
  const elapsedLabel = useMemo(
    () => formatClockElapsed(elapsedMs),
    [elapsedMs],
  );
  const elapsedMinutes = useMemo(
    () => Math.floor(elapsedMs / 60000),
    [elapsedMs],
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (hasActive && start) {
          await requestPersistentClockNotification(elapsedLabel);
          await trySetAppBadge(elapsedMinutes);
        } else {
          await clearClockNotification();
          await clearAppBadge();
          if (pipOn) {
            stopClockPiP();
            if (isMounted) setPipOn(false);
          }
        }
      } catch (error) {
        logError(error, { where: "TimeClockBubble", action: "pwaLifecycle" });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [hasActive, start, elapsedLabel, elapsedMinutes, pipOn]);

  useEffect(() => {
    if (!(hasActive && start)) return undefined;
    const interval = setInterval(async () => {
      try {
        await requestPersistentClockNotification(elapsedLabel, {
          silent: true,
        });
        await trySetAppBadge(elapsedMinutes);
        if (pipOn && isPiPActive()) {
          await updateClockPiP(elapsedLabel);
        }
      } catch (error) {
        logError(error, { where: "TimeClockBubble", action: "ticker" });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [hasActive, start, elapsedLabel, elapsedMinutes, pipOn]);

  useEffect(() => {
    if (!pipOn) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (isPiPActive()) {
          await updateClockPiP(elapsedLabel);
        }
      } catch (error) {
        if (!cancelled) {
          logError(error, { where: "TimeClockBubble", action: "pipRefresh" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipOn, elapsedLabel]);

  useEffect(
    () => () => {
      stopClockPiP();
    },
    [],
  );

  if (!(hasActive && start)) {
    return null;
  }

  const handlePiPToggle = async () => {
    try {
      if (pipOn) {
        stopClockPiP();
        setPipOn(false);
        return;
      }
      const ok = await startClockPiP(elapsedLabel);
      if (ok) {
        setPipOn(true);
      } else {
        setPipOn(false);
        logError(new Error("pip-start-failed"), {
          where: "TimeClockBubble",
          action: "pipDenied",
        });
      }
    } catch (error) {
      logError(error, { where: "TimeClockBubble", action: "pipToggle" });
      setPipOn(false);
    }
  };

  const node = (
    <Fade in timeout={200}>
      <Paper
        elevation={6}
        sx={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: (theme) => (theme.zIndex?.modal ?? 1300) + 10,
          bgcolor: "#0b0b0b",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: collapsed ? 1 : 1.5,
          py: 1,
          boxShadow: "0 6px 30px rgba(0,0,0,0.45)",
        }}
        aria-label="On the clock bubble"
        role="status"
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: LRP.green,
            color: LRP.black,
            flexShrink: 0,
          }}
        >
          <AccessTimeFilledIcon fontSize="small" />
        </Box>

        {!collapsed && (
          <Typography
            variant="body2"
            sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 600 }}
          >
            On the clock • {elapsedLabel}
          </Typography>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            ml: collapsed ? 0.5 : 1,
          }}
        >
          <Tooltip title="Open Time Clock">
            <IconButton
              size="small"
              onClick={() => openTimeClockModal()}
              aria-label="Open Time Clock"
              sx={{ color: "#fff" }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {isPiPSupported() && (
            <Tooltip title={pipOn ? "Close mini ticker" : "Open mini ticker"}>
              <IconButton
                size="small"
                aria-label="Toggle floating mini ticker"
                onClick={handlePiPToggle}
                sx={{ color: "#fff" }}
              >
                <PictureInPictureAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title={collapsed ? "Expand" : "Collapse"}>
            <IconButton
              size="small"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand bubble" : "Collapse bubble"}
              sx={{ color: "rgba(255,255,255,0.85)" }}
            >
              {collapsed ? (
                <OpenInNewIcon fontSize="small" />
              ) : (
                <CloseIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    </Fade>
  );

  const container = typeof document !== "undefined" ? document.body : null;
  return container ? createPortal(node, container) : node;
}
