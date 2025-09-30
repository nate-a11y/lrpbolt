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
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PictureInPictureAltIcon from "@mui/icons-material/PictureInPictureAlt";
import CloseIcon from "@mui/icons-material/Close";

import useElapsedFromTs from "@/hooks/useElapsedFromTs.js";
import useActiveTimeSession from "@/hooks/useActiveTimeSession.js";
import { openTimeClockModal } from "@/services/uiBus";
import {
  requestPersistentClockNotification,
  stopPersistentClockNotification as stopPersistentClockNotificationImport,
  clearClockNotification as clearClockNotificationImport,
} from "@/pwa/clockNotifications";
import {
  trySetAppBadge,
  clearAppBadge as clearAppBadgeImport,
} from "@/pwa/appBadge";
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

const LRP = { green: "#4cbb17", black: "#060606" };

function ActiveTimeClockBubble({
  hasActive,
  startTimeTs,
  stopPersistentClockNotification: stopPersistentClockNotificationOverride,
  clearClockNotification: clearClockNotificationOverride,
  clearAppBadge: clearAppBadgeOverride,
}) {
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
  const stopPersistentClockNotificationFn =
    stopPersistentClockNotificationOverride ??
    stopPersistentClockNotificationImport;
  const clearClockNotificationFn =
    clearClockNotificationOverride ?? clearClockNotificationImport;
  const clearAppBadgeFn = clearAppBadgeOverride ?? clearAppBadgeImport;
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
          const canNotify =
            typeof Notification !== "undefined" &&
            Notification.permission === "granted";
          if (canNotify) {
            await requestPersistentClockNotification(elapsedLabel);
          }
          await trySetAppBadge(elapsedMinutes);
        } else if (wasActiveRef.current) {
          if (typeof stopPersistentClockNotificationFn === "function") {
            await stopPersistentClockNotificationFn();
          }
          if (typeof clearClockNotificationFn === "function") {
            await clearClockNotificationFn();
          }
          if (typeof clearAppBadgeFn === "function") {
            await clearAppBadgeFn();
          }
          if (pipOn) {
            stopClockPiP();
            if (isMounted) setPipOn(false);
          }
          wasActiveRef.current = false;
        }
      } catch (error) {
        logError(error, { where: "TimeClockBubble", action: "pwaLifecycle" });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [
    clearAppBadgeFn,
    clearClockNotificationFn,
    elapsedLabel,
    elapsedMinutes,
    hasValidStart,
    pipOn,
    startMs,
    stopPersistentClockNotificationFn,
  ]);

  useEffect(() => {
    if (!hasValidStart) return undefined;
    const interval = setInterval(async () => {
      try {
        const canNotify =
          typeof Notification !== "undefined" &&
          Notification.permission === "granted";
        if (canNotify) {
          await requestPersistentClockNotification(elapsedLabel, {
            silent: true,
          });
        }
        await trySetAppBadge(elapsedMinutes);
        if (pipOn && isPiPActive()) {
          await updateClockPiP("On the clock", startMs ?? Date.now());
        }
      } catch (error) {
        logError(error, { where: "TimeClockBubble", action: "ticker" });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [elapsedLabel, elapsedMinutes, hasValidStart, pipOn, startMs]);

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
          bottom: 16,
          zIndex: (theme) => {
            const modal = theme.zIndex?.modal ?? 1300;
            const drawer = theme.zIndex?.drawer ?? 1200;
            const snackbar = theme.zIndex?.snackbar ?? 1400;
            const tooltip = theme.zIndex?.tooltip ?? 1500;
            return Math.max(modal, drawer, snackbar, tooltip) + 4;
          },
          bgcolor: "#0b0b0b",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: collapsed ? 1 : 1.5,
          py: 1,
          boxShadow: "0 6px 30px rgba(0,0,0,0.45)",
          pointerEvents: isVisible ? "auto" : "none",
        }}
        aria-label="On the clock bubble"
        aria-hidden={!isVisible}
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
      console.info("[LRP][TimeClockBubble] mounted");
    }
  }, []);

  useEffect(() => {
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
