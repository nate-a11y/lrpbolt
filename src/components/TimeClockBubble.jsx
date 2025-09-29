/* Proprietary and confidential. See LICENSE. */
import { useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { tryRequestWakeLock, releaseWakeLock } from "@/pwa/wakeLock";
import { startClockPiP, stopClockPiP, isPiPSupported } from "@/pwa/pipTicker";
import { formatClockElapsed } from "@/utils/timeUtils.js";
import logError from "@/utils/logError.js";

const BRAND = { green: "#4cbb17", black: "#060606" };

export default function TimeClockBubble() {
  useEffect(() => {
    console.debug("[TimeClockBubble] mounted");
  }, []);

  const { hasActive, startTimeTs } = useContext(ActiveClockContext);
  const { start, elapsedMs } = useElapsedFromTs(startTimeTs);
  const [collapsed, setCollapsed] = useState(false);
  const [pipOn, setPipOn] = useState(false);
  const elapsedLabel = useMemo(() => formatClockElapsed(elapsedMs), [elapsedMs]);
  const labelRef = useRef(elapsedLabel);
  const elapsedMinutesRef = useRef(Math.floor(elapsedMs / 60000));

  useEffect(() => {
    labelRef.current = elapsedLabel;
    elapsedMinutesRef.current = Math.floor(elapsedMs / 60000);
  }, [elapsedLabel, elapsedMs]);

  useEffect(() => {
    (async () => {
      try {
        if (hasActive && start) {
          await requestPersistentClockNotification(labelRef.current);
          await trySetAppBadge(elapsedMinutesRef.current);
          await tryRequestWakeLock();
        } else {
          await clearClockNotification();
          await clearAppBadge();
          await releaseWakeLock();
          if (pipOn) {
            stopClockPiP();
            setPipOn(false);
          }
        }
      } catch (error) {
        logError(error, { where: "TimeClockBubble", action: "pwaLifecycle" });
      }
    })();
  }, [hasActive, start, pipOn]);

  useEffect(() => {
    if (!(hasActive && start)) return undefined;
    const interval = setInterval(async () => {
      try {
        await requestPersistentClockNotification(labelRef.current, { silent: true });
        await trySetAppBadge(elapsedMinutesRef.current);
        if (pipOn) {
          await startClockPiP(labelRef.current);
        }
      } catch (error) {
        logError(error, { where: "TimeClockBubble", action: "ticker" });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [hasActive, start, pipOn]);

  useEffect(() => {
    if (!pipOn) return undefined;
    startClockPiP(labelRef.current).catch((error) =>
      logError(error, { where: "TimeClockBubble", action: "pipInit" }),
    );
    return () => {
      stopClockPiP();
    };
  }, [pipOn]);

  useEffect(
    () => () => {
      stopClockPiP();
    },
    [],
  );

  if (!(hasActive && start)) {
    console.debug(
      "[TimeClockBubble] hidden (active:",
      hasActive,
      "start:",
      Boolean(start),
      ")",
    );
    return null;
  }

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
            bgcolor: BRAND.green,
            color: BRAND.black,
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

        <Box sx={{ display: "flex", alignItems: "center", ml: collapsed ? 0.5 : 1 }}>
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
                onClick={() => {
                  try {
                    if (pipOn) {
                      stopClockPiP();
                      setPipOn(false);
                    } else {
                      setPipOn(true);
                    }
                  } catch (error) {
                    logError(error, { where: "TimeClockBubble", action: "pipToggle" });
                  }
                }}
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
              {collapsed ? <OpenInNewIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    </Fade>
  );

  const container = typeof document !== "undefined" ? document.body : null;
  return container ? createPortal(node, container) : node;
}
