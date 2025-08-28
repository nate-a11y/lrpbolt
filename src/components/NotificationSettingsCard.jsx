/* Proprietary and confidential. See LICENSE. */
import { useCallback, useState } from "react";
import { Paper, Stack, Typography, Button, Chip, Alert } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";

import useNotificationPermission from "../hooks/useNotificationPermission";
import {
  enableFcmForUser,
  disableFcmForUser,
  ensureFcmToken,
} from "../utils/fcm";

/** Put this on Profile/Settings (admin & driver) */
export default function NotificationSettingsCard({ user }) {
  const { supported, permission } = useNotificationPermission();
  const [busy, setBusy] = useState(false);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await enableFcmForUser(user, { source: "settings-card" });
    } finally {
      setBusy(false);
    }
  }, [user]);

  const ensure = useCallback(async () => {
    setBusy(true);
    try {
      await ensureFcmToken(user, { source: "ensure" });
    } finally {
      setBusy(false);
    }
  }, [user]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disableFcmForUser(user);
    } finally {
      setBusy(false);
    }
  }, [user]);

  if (!supported) {
    return (
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Alert severity="warning">
          This browser doesn’t support push notifications.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={700}>
          Notifications
        </Typography>
        <Chip
          icon={permission === "granted" ? <CheckCircleIcon /> : <BlockIcon />}
          color={
            permission === "granted"
              ? "success"
              : permission === "denied"
                ? "error"
                : "default"
          }
          label={
            permission === "granted"
              ? "Enabled"
              : permission === "denied"
                ? "Blocked in browser"
                : "Not enabled"
          }
        />
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: "wrap" }}>
        {permission === "granted" ? (
          <>
            <Button onClick={ensure} disabled={busy} variant="outlined">
              Refresh token
            </Button>
            <Button onClick={disable} disabled={busy} color="warning">
              Disable on this device
            </Button>
          </>
        ) : permission === "default" ? (
          <Button onClick={enable} disabled={busy} variant="contained">
            Enable notifications
          </Button>
        ) : (
          <Alert severity="info" sx={{ mt: 1 }}>
            Notifications are blocked in your browser. Change site permissions,
            then click “Enable notifications”.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
