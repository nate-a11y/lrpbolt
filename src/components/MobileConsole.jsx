/* Mobile Console - Comprehensive diagnostic and console overlay for mobile devices */
/* global __APP_VERSION__ */
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Badge,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorIcon from "@mui/icons-material/ErrorOutline";

import { diagShowSwNotification } from "@/pwa/clockNotifications";
import { setFlag, logEvent, captureError } from "@/services/observability";
import VersionBadge from "./VersionBadge.jsx";

const MAX_LOGS = 100;
const successStatuses = new Set(["ok", "granted"]);

// Detect if we're on mobile
function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 1.5 }}>{children}</Box>}
    </div>
  );
}

function StatusItem({ label, value }) {
  const color = successStatuses.has(value)
    ? "success"
    : value === "unknown"
      ? "default"
      : "warning";

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
      <Typography variant="caption" sx={{ minWidth: 100, fontSize: 11 }}>
        {label}
      </Typography>
      <Chip
        icon={successStatuses.has(value) ? <CheckIcon /> : <ErrorIcon />}
        color={color}
        label={String(value)}
        size="small"
        variant="outlined"
        sx={{ height: 20, fontSize: 10 }}
      />
    </Stack>
  );
}

function LogEntry({ entry }) {
  const getLogColor = (type) => {
    if (type === "error") return "error.main";
    if (type === "warn") return "warning.main";
    return "success.main";
  };

  const borderColor = getLogColor(entry.type);

  return (
    <Box
      sx={{
        mb: 0.5,
        p: 0.75,
        borderLeft: (theme) => `3px solid ${theme.palette[entry.type === "error" ? "error" : entry.type === "warn" ? "warning" : "success"].main}`,
        bgcolor: (theme) => alpha(theme.palette.common.white, 0.05),
        fontSize: 10,
        fontFamily: "monospace",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography
          sx={{
            color: borderColor,
            fontWeight: "bold",
            fontSize: 9,
            minWidth: 50,
          }}
        >
          {entry.type.toUpperCase()}
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: 9 }}>
          {entry.timestamp}
        </Typography>
      </Stack>
      <Typography
        sx={{
          color: "text.primary",
          mt: 0.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 10,
        }}
      >
        {entry.message}
      </Typography>
    </Box>
  );
}

export default function MobileConsole() {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [logs, setLogs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const logCountRef = useRef(0);

  // Diagnostics state
  const [diagState, setDiagState] = useState({
    sw: "unknown",
    fcm: "unknown",
    firestore: "unknown",
    version: "unknown",
  });

  // Notification diagnostic state
  const [perm, setPerm] = useState("default");
  const [controlled, setControlled] = useState(false);
  const [swReady, setSwReady] = useState(null);
  const [regs, setRegs] = useState([]);

  // Only show on mobile devices
  const shouldShow = useMemo(() => isMobileDevice(), []);

  // Diagnostics checks
  const checkSW = useCallback(() => {
    try {
      const hasSw =
        typeof navigator !== "undefined" && "serviceWorker" in navigator;
      setDiagState((prev) => ({ ...prev, sw: hasSw ? "ok" : "missing" }));
    } catch (err) {
      captureError(err, { where: "MobileConsole.checkSW" });
      setDiagState((prev) => ({ ...prev, sw: "error" }));
    }
  }, []);

  const checkFCM = useCallback(() => {
    try {
      const hasNotifications =
        typeof window !== "undefined" && "Notification" in window;
      const permission = hasNotifications
        ? Notification.permission || "ok"
        : "missing";
      setDiagState((prev) => ({ ...prev, fcm: permission }));
      setPerm(permission);
    } catch (err) {
      captureError(err, { where: "MobileConsole.checkFCM" });
      setDiagState((prev) => ({ ...prev, fcm: "error" }));
    }
  }, []);

  const checkFirestore = useCallback(async () => {
    try {
      const { getDb } = await import("@/services/firestoreCore");
      const db = getDb();
      setDiagState((prev) => ({ ...prev, firestore: db ? "ok" : "missing" }));
    } catch (err) {
      captureError(err, { where: "MobileConsole.checkFirestore" });
      setDiagState((prev) => ({ ...prev, firestore: "error" }));
    }
  }, []);

  const handleRefresh = useCallback(() => {
    logEvent("mobile_console_refresh", { ts: Date.now() });
    checkSW();
    checkFCM();
    checkFirestore();
  }, [checkFCM, checkFirestore, checkSW]);

  const handleGridDebugToggle = useCallback((value) => {
    setFlag("grid.debug", value);
    logEvent("mobile_grid_debug_toggle", { value, ts: Date.now() });
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    const res = await Notification.requestPermission();
    setPerm(res);
    checkFCM();
  }, [checkFCM]);

  const handlePageNotify = useCallback(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification("Mobile Console Test", { body: "Test notification from mobile console" });
    } catch (error) {
      console.error("[MobileConsole] page notify failed", error);
    }
  }, []);

  const addLog = useCallback((type, args) => {
    const timestamp = new Date().toLocaleTimeString();
    logCountRef.current += 1;

    let message = "";
    try {
      message = Array.from(args)
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
          }
          if (typeof arg === "object") {
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        })
        .join(" ");
    } catch (e) {
      message = String(args);
    }

    const entry = {
      id: logCountRef.current,
      type,
      timestamp,
      message,
    };

    setLogs((prev) => {
      const newLogs = [entry, ...prev].slice(0, MAX_LOGS);
      return newLogs;
    });

    // Increment unread count if console is not expanded or not on console tab
    setUnreadCount((prev) => prev + 1);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    logCountRef.current = 0;
    setUnreadCount(0);
  }, []);

  const handleExpandToggle = useCallback(() => {
    setExpanded((prev) => !prev);
    if (!expanded) {
      setUnreadCount(0); // Clear unread when expanding
    }
  }, [expanded]);

  const handleClose = useCallback(() => {
    setVisible(false);
    logEvent("mobile_console_closed", { ts: Date.now() });
  }, []);

  const handleTabChange = useCallback((event, newValue) => {
    setTabIndex(newValue);
    if (newValue === 0) {
      setUnreadCount(0); // Clear unread when switching to console tab
    }
  }, []);

  // Initialize diagnostics
  useEffect(() => {
    setDiagState((prev) => ({
      ...prev,
      version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
    }));
    checkSW();
    checkFCM();
    checkFirestore();
  }, [checkFCM, checkFirestore, checkSW]);

  // Service worker messaging
  useEffect(() => {
    const onMessage = (event) => {
      const type = event?.data?.type;
      if (type === "SW_READY" || type === "PONG") {
        setSwReady({ v: event?.data?.v, scope: event?.data?.scope });
      }
    };

    const onControllerChange = () => {
      const controlled = Boolean(navigator.serviceWorker?.controller);
      setControlled(controlled);
    };

    navigator.serviceWorker?.addEventListener?.("message", onMessage);
    navigator.serviceWorker?.addEventListener?.(
      "controllerchange",
      onControllerChange
    );

    // Initial check
    setControlled(Boolean(navigator.serviceWorker?.controller));

    // Get registrations
    (async () => {
      try {
        const list = await navigator.serviceWorker?.getRegistrations?.();
        setRegs(
          (list || []).map((registration) => ({
            scope: registration.scope,
            script:
              registration.active?.scriptURL ||
              registration.waiting?.scriptURL ||
              registration.installing?.scriptURL ||
              "unknown",
          }))
        );
      } catch (error) {
        console.error("[MobileConsole] registrations failed", error);
      }
    })();

    return () => {
      navigator.serviceWorker?.removeEventListener?.("message", onMessage);
      navigator.serviceWorker?.removeEventListener?.(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  // Ping service worker periodically
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const registration = await navigator.serviceWorker?.ready.catch(
          () => null
        );
        if (cancelled) return;
        const target =
          navigator.serviceWorker?.controller || registration?.active;
        target?.postMessage?.({ type: "PING" });
      } catch (error) {
        console.error("[MobileConsole] ping failed", error);
      }
    };

    ping();
    const interval = setInterval(ping, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Intercept console methods
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalLog = console.log;

    console.error = function (...args) {
      addLog("error", args);
      originalError.apply(console, args);
    };

    console.warn = function (...args) {
      addLog("warn", args);
      originalWarn.apply(console, args);
    };

    console.log = function (...args) {
      addLog("log", args);
      originalLog.apply(console, args);
    };

    // Capture unhandled errors
    const handleError = (event) => {
      addLog("error", [
        `Unhandled Error: ${event.message}`,
        `File: ${event.filename}:${event.lineno}:${event.colno}`,
        event.error,
      ]);
    };

    const handleRejection = (event) => {
      addLog("error", [`Unhandled Promise Rejection:`, event.reason]);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    // Add initial message
    addLog("log", ["Mobile console initialized"]);

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      console.log = originalLog;
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [addLog]);

  if (!shouldShow || !visible) return null;

  const permChipColor =
    perm === "granted" ? "success" : perm === "denied" ? "error" : "default";

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        bgcolor: (theme) => alpha(theme.palette.common.black, 0.95),
        color: "text.primary",
        maxHeight: expanded ? "80vh" : "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
          borderBottom: (theme) => `2px solid ${theme.palette.primary.main}`,
          cursor: "pointer",
        }}
        onClick={handleExpandToggle}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ fontWeight: "bold", fontSize: 11 }}>
            📱 MOBILE CONSOLE
          </Typography>
          {!expanded && unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" max={99} />
          )}
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            sx={{ color: "text.primary", p: 0.5 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleExpandToggle();
            }}
            sx={{ color: "text.primary", p: 0.5 }}
          >
            {expanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Stack>
      </Box>

      {/* Content */}
      {expanded && (
        <>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              minHeight: 36,
              bgcolor: (theme) => alpha(theme.palette.common.black, 0.5),
              "& .MuiTab-root": {
                minHeight: 36,
                fontSize: 10,
                color: "text.primary",
              },
            }}
          >
            <Tab label={`Console (${logs.length})`} />
            <Tab label="Diagnostics" />
            <Tab label="Actions" />
          </Tabs>

          <Box sx={{ overflowY: "auto", flex: 1 }}>
            {/* Console Tab */}
            <TabPanel value={tabIndex} index={0}>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={clearLogs}
                  fullWidth
                  sx={{ fontSize: 10 }}
                >
                  Clear Logs
                </Button>
              </Stack>
              <Box sx={{ maxHeight: "60vh", overflowY: "auto" }}>
                {logs.length === 0 ? (
                  <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
                    No logs yet...
                  </Typography>
                ) : (
                  logs.map((entry) => <LogEntry key={entry.id} entry={entry} />)
                )}
              </Box>
            </TabPanel>

            {/* Diagnostics Tab */}
            <TabPanel value={tabIndex} index={1}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ fontWeight: "bold", fontSize: 11 }}>
                    System Status
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleRefresh}
                    sx={{ color: "text.primary", p: 0.5 }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <StatusItem label="Service Worker" value={diagState.sw} />
                <StatusItem label="Notifications/FCM" value={diagState.fcm} />
                <StatusItem label="Firestore" value={diagState.firestore} />
                <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
                  <Typography variant="caption" sx={{ minWidth: 100, fontSize: 11 }}>
                    Version
                  </Typography>
                  <VersionBadge value={diagState.version} />
                </Stack>
                <Divider sx={{ my: 1, bgcolor: "divider" }} />
                <Typography variant="caption" sx={{ fontWeight: "bold", fontSize: 11 }}>
                  SW Details
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                  <Chip
                    size="small"
                    label={`perm:${perm}`}
                    color={permChipColor}
                    sx={{ fontSize: 9, height: 20 }}
                  />
                  <Chip
                    size="small"
                    label={controlled ? "controlled" : "not-controlled"}
                    sx={{ fontSize: 9, height: 20 }}
                  />
                  <Chip
                    size="small"
                    label={swReady ? `SW v${swReady.v}` : "SW ?"}
                    sx={{ fontSize: 9, height: 20 }}
                  />
                </Stack>
                {regs.length > 0 && (
                  <Box
                    sx={{
                      mt: 1,
                      fontSize: 9,
                      fontFamily: "monospace",
                      color: "text.secondary",
                      maxHeight: 100,
                      overflowY: "auto",
                    }}
                  >
                    {regs.map((reg, index) => (
                      <div key={reg.scope || index}>
                        {reg.scope} → {reg.script}
                      </div>
                    ))}
                  </Box>
                )}
              </Stack>
            </TabPanel>

            {/* Actions Tab */}
            <TabPanel value={tabIndex} index={2}>
              <Stack spacing={1}>
                <Typography variant="caption" sx={{ fontWeight: "bold", fontSize: 11, mb: 1 }}>
                  Notifications
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  onClick={requestPermission}
                  fullWidth
                  sx={{ fontSize: 10 }}
                >
                  Request Permission
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => diagShowSwNotification("Mobile console test")}
                  fullWidth
                  sx={{ fontSize: 10 }}
                >
                  Test SW Notification
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handlePageNotify}
                  fullWidth
                  sx={{ fontSize: 10 }}
                >
                  Test Page Notification
                </Button>
                <Divider sx={{ my: 1, bgcolor: "divider" }} />
                <Typography variant="caption" sx={{ fontWeight: "bold", fontSize: 11, mb: 1 }}>
                  Grid Debug
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleGridDebugToggle(true)}
                    fullWidth
                    sx={{ fontSize: 10 }}
                  >
                    Enable
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleGridDebugToggle(false)}
                    fullWidth
                    sx={{ fontSize: 10 }}
                  >
                    Disable
                  </Button>
                </Stack>
              </Stack>
            </TabPanel>
          </Box>
        </>
      )}
    </Paper>
  );
}
