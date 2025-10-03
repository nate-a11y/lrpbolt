/* LRP Portal enhancement: diagnostics panel, 2025-10-03 */
/* global __APP_VERSION__ */
import { useCallback, useEffect, useState } from "react";
import { Paper, Typography, Stack, Button, Chip, Divider } from "@mui/material";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorIcon from "@mui/icons-material/ErrorOutline";
import RefreshIcon from "@mui/icons-material/Refresh";

import { setFlag, logEvent, captureError } from "@/services/observability";

const successStatuses = new Set(["ok", "granted"]);

function StatusItem({ label, value }) {
  const color = successStatuses.has(value)
    ? "success"
    : value === "unknown"
      ? "default"
      : "warning";

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
      <Typography sx={{ width: 140 }}>{label}</Typography>
      <Chip
        icon={successStatuses.has(value) ? <CheckIcon /> : <ErrorIcon />}
        color={color}
        label={String(value)}
        size="small"
        variant="outlined"
      />
    </Stack>
  );
}

export default function DiagnosticsPanel() {
  const [state, setState] = useState({
    sw: "unknown",
    fcm: "unknown",
    firestore: "unknown",
    version: "unknown",
  });

  const checkSW = useCallback(() => {
    try {
      const hasSw =
        typeof navigator !== "undefined" && "serviceWorker" in navigator;
      setState((prev) => ({ ...prev, sw: hasSw ? "ok" : "missing" }));
    } catch (err) {
      captureError(err, { where: "DiagnosticsPanel.checkSW" });
      setState((prev) => ({ ...prev, sw: "error" }));
    }
  }, []);

  const checkFCM = useCallback(() => {
    try {
      const hasNotifications =
        typeof window !== "undefined" && "Notification" in window;
      const permission = hasNotifications
        ? Notification.permission || "ok"
        : "missing";
      setState((prev) => ({ ...prev, fcm: permission }));
    } catch (err) {
      captureError(err, { where: "DiagnosticsPanel.checkFCM" });
      setState((prev) => ({ ...prev, fcm: "error" }));
    }
  }, []);

  const checkFirestore = useCallback(async () => {
    try {
      const { getDb } = await import("@/services/firestoreCore");
      const db = getDb();
      setState((prev) => ({ ...prev, firestore: db ? "ok" : "missing" }));
    } catch (err) {
      captureError(err, { where: "DiagnosticsPanel.checkFirestore" });
      setState((prev) => ({ ...prev, firestore: "error" }));
    }
  }, []);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
    }));
    checkSW();
    checkFCM();
    checkFirestore();
  }, [checkFCM, checkFirestore, checkSW]);

  const handleRefresh = useCallback(() => {
    logEvent("diag_refresh", { ts: Date.now() });
    checkSW();
    checkFCM();
    checkFirestore();
  }, [checkFCM, checkFirestore, checkSW]);

  const handleGridDebugToggle = useCallback((value) => {
    setFlag("grid.debug", value);
    logEvent("grid_debug_toggle", { value, ts: Date.now() });
  }, []);

  return (
    <Paper elevation={0} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Diagnostics</Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </Stack>
      <Divider sx={{ my: 1 }} />
      <StatusItem label="Service Worker" value={state.sw} />
      <StatusItem label="Notifications/FCM" value={state.fcm} />
      <StatusItem label="Firestore" value={state.firestore} />
      <StatusItem label="Version" value={state.version} />
      <Divider sx={{ my: 1 }} />
      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => handleGridDebugToggle(true)}
        >
          Enable Grid Debug
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => handleGridDebugToggle(false)}
        >
          Disable Grid Debug
        </Button>
      </Stack>
    </Paper>
  );
}
