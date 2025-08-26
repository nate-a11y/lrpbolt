/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useState } from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, Typography, Alert
} from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

import useNotificationPermission from "../hooks/useNotificationPermission";
import { enableFcmForUser } from "../utils/fcm";

/**
 * Shows a friendly prompt once per device until user chooses Allow or "Not now".
 * Persists "snooze" in localStorage and respects blocked state.
 */
export default function NotificationsOptInDialog({ user }) {
  const { supported, permission } = useNotificationPermission();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const snoozeKey = "lrp_fcm_snooze_until";

  // open only if: supported, not granted, not denied, not snoozed
  useEffect(() => {
    if (!supported) return;
    if (permission !== "default") return; // granted or denied => don't show
    const until = Number(localStorage.getItem(snoozeKey) || 0);
    if (Date.now() > until) setOpen(true);
  }, [supported, permission]);

  const handleEnable = useCallback(async () => {
    try {
      setLoading(true);
      await enableFcmForUser(user, { source: "optin-dialog" });
      setOpen(false);
    } catch (e) {
      console.warn("FCM permission/token error:", e?.message || e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleNotNow = useCallback(() => {
    // snooze 7 days
    const next = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(snoozeKey, String(next));
    setOpen(false);
  }, []);

  if (!user?.email) return null;
  if (!supported) return null;

  return (
    <Dialog open={open} onClose={handleNotNow} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <NotificationsActiveIcon color="primary" />
        Enable Notifications
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography>Get heads‑up alerts for assigned rides, queue updates, and schedule changes.</Typography>
          {permission === "default" && (
            <Alert severity="info">You’ll see a browser prompt after you click Enable.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleNotNow} disabled={loading}>Not now</Button>
        <Button onClick={handleEnable} variant="contained" disabled={loading}>
          {loading ? "Enabling…" : "Enable"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
