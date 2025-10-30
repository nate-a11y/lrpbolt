/* Proprietary and confidential. See LICENSE. */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Fade,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PictureInPictureAltIcon from "@mui/icons-material/PictureInPictureAlt";
import CloseIcon from "@mui/icons-material/Close";

import useElapsedFromTs from "@/hooks/useElapsedFromTs.js";
import useActiveTimeSession from "@/hooks/useActiveTimeSession.js";
import { openTimeClockModal } from "@/services/uiBus";
import { trySetAppBadge, clearAppBadge } from "@/pwa/appBadge";
import {
  showPersistentClockNotification,
  clearPersistentClockNotification,
} from "@/services/clockNotifications.js";
import useWakeLock from "@/hooks/useWakeLock.js";
import {
  startClockPiP,
  stopClockPiP,
  isPiPSupported,
  isPiPActive,
  updateClockPiP,
} from "@/pwa/pipTicker";
import { initPiPBridge } from "@/pwa/pipBridge";
import { formatClockElapsed } from "@/utils/timeUtils.js";
import { isValidTimestamp } from "@/utils/time.js";
import logError from "@/utils/logError.js";
import { useAuth } from "@/context/AuthContext.jsx";
import { pickFirst, START_KEYS } from "@/utils/timeGuards.js";

function ActiveTimeClockBubble({ hasActive, startTimeTs }) {
  const startForTimer = hasActive && startTimeTs ? startTimeTs : null;
  const { start, startMs, elapsedMs } = useElapsedFromTs(startForTimer, {
    logOnNullOnce: false,
  });
  const hasValidStart = Boolean(start);
  // Keep screen awake only while actually on the clock
  useWakeLock(hasValidStart);
  const [collapsed, setCollapsed] = useState(false);
  const [pipOn, setPipOn] = useState(false);
  const wasActiveRef = useRef(false);
  useEffect(() => {
    initPiPBridge();
  }, []);
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
        if (hasValidStart && startMs) {
          wasActiveRef.current = true;
          await showPersistentClockNotification({
            elapsedLabel,
            elapsedMinutes,
          });
          await trySetAppBadge(elapsedMinutes);
        } else if (wasActiveRef.current) {
          await clearPersistentClockNotification();
          await clearAppBadge();
          if (pipOn) {
            stopClockPiP();
            if (isMounted) setPipOn(false);
          }
          wasActiveRef.current = false;
        } else {
          await clearPersistentClockNotification();
          await clearAppBadge();
        }
      } catch (error) {
        logError(error, { where: "TimeClockBubble", action: "pwaLifecycle" });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [elapsedLabel, elapsedMinutes, hasValidStart, pipOn, startMs]);

  useEffect(() => {
    if (!hasValidStart) return undefined;
    const interval = setInterval(async () => {
      try {
        await showPersistentClockNotification({
          elapsedLabel,
          elapsedMinutes,
        });
        await trySetAppBadge(elapsedMinutes);
        if (pipOn && isPiPActive()) {
          await updateClockPiP("On the clock", startMs ?? Date.now());
        }
      } catch (error) {
        logError(error, { where: "TimeClockBubble", action: "ticker" });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [elapsedLabel, elapsedMinutes, hasValidStart, pipOn, startMs]);

  useEffect(
    () => () => {
      clearPersistentClockNotification().catch((error) => {
        logError(error, { where: "TimeClockBubble", action: "cleanupClear" });
      });
    },
    [],
  );

  useEffect(() => {
    if (!pipOn) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (isPiPActive()) {
          await updateClockPiP("On the clock", startMs ?? Date.now());
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
  }, [elapsedLabel, pipOn, startMs]);

  useEffect(
    () => () => {
      stopClockPiP();
    },
    [],
  );

  const isVisible = hasValidStart;

  const handlePiPToggle = async () => {
    try {
      if (pipOn) {
        stopClockPiP();
        setPipOn(false);
        return;
      }
      const ok = await startClockPiP("On the clock", startMs ?? Date.now());
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
    <Fade in={isVisible} timeout={200}>
      <Paper
        elevation={6}
        sx={{
          position: "fixed",
          right: 16,
          bottom: 80,
          zIndex: (theme) => {
            const modal = theme.zIndex?.modal ?? 1300;
            const drawer = theme.zIndex?.drawer ?? 1200;
            const snackbar = theme.zIndex?.snackbar ?? 1400;
            const tooltip = theme.zIndex?.tooltip ?? 1500;
            return Math.max(modal, drawer, snackbar, tooltip) + 4;
          },
          bgcolor: (t) => t.palette.background.paper,
          border: (t) => `1px solid ${t.palette.divider}`,
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: collapsed ? 1 : 1.5,
          py: 1,
          boxShadow: (t) => `0 6px 30px ${alpha(t.palette.common.black, 0.45)}`,
          pointerEvents: isVisible ? "auto" : "none",
        }}
        aria-label="On the clock bubble"
        role="status"
      >
        <Box
          sx={(t) => ({
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: t.palette.primary.main,
            color: t.palette.getContrastText(t.palette.primary.main),
            flexShrink: 0,
          })}
        >
          <AccessTimeFilledIcon fontSize="small" />
        </Box>

        {!collapsed && (
          <Typography
            variant="body2"
            sx={{
              color: (t) => alpha(t.palette.common.white, 0.9),
              fontWeight: 600,
            }}
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
              sx={{ color: "text.primary" }}
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
                sx={{ color: "text.primary" }}
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
              sx={{ color: (t) => alpha(t.palette.common.white, 0.85) }}
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

export default function TimeClockBubble() {
  const { user } = useAuth?.() || { user: null };
  const { session } = useActiveTimeSession(user);
  const startRaw = session ? pickFirst(session, START_KEYS) : null;
  const startTimeTs = isValidTimestamp(startRaw) ? startRaw : null;
  const hasActive = Boolean(session);
  const hasValidStart = Boolean(startTimeTs);
  const didLogRef = useRef(false);
  const sessionId = session?.id || null;

  useEffect(() => {
    if (!didLogRef.current) {
      didLogRef.current = true;
      // eslint-disable-next-line no-console
      console.info("[LRP][TimeClockBubble] mounted");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[LRP][TimeClockBubble] state:", {
      hasActive,
      hasValidStart,
      sessionId,
      startField:
        session?.__startField || (startTimeTs ? "(guessed)" : "(none)"),
      startTsType: startTimeTs?.toDate
        ? "FirestoreTimestamp"
        : typeof startTimeTs,
    });
  }, [hasActive, hasValidStart, session?.__startField, sessionId, startTimeTs]);

  return (
    <ActiveTimeClockBubble hasActive={hasActive} startTimeTs={startTimeTs} />
  );
}
