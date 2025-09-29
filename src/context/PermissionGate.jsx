/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useState } from "react";
import { Box, Button, Typography, Paper, Stack } from "@mui/material";

const LRP = { green: "#4cbb17", black: "#060606" };

function PermissionOverlay({ onContinue }) {
  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: "#060606",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        p: 3,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          bgcolor: "#0b0b0b",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 2,
          maxWidth: 420,
          width: "100%",
          p: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
          Permissions Required
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 2, color: "rgba(255,255,255,0.8)" }}
        >
          To continue using Lake Ride Pros, please enable notifications and
          screen wake permissions. This ensures you never forget you’re on the
          clock.
        </Typography>
        <Stack spacing={2}>
          <Button
            fullWidth
            variant="contained"
            onClick={onContinue}
            sx={{ bgcolor: LRP.green, color: LRP.black, fontWeight: 600 }}
          >
            Enable & Continue
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

/**
 * Blocks the app until Notification permission is "granted".
 * Optionally requests Wake Lock on entry (supported Chrome/Android).
 */
export default function PermissionGate({ children }) {
  const [allowed, setAllowed] = useState(false);

  const checkStatus = useCallback(() => {
    try {
      if (Notification.permission === "granted") {
        setAllowed(true);
      } else {
        setAllowed(false);
      }
    } catch (e) {
      console.error("[PermissionGate] checkStatus failed", e);
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleContinue = useCallback(async () => {
    try {
      const res = await Notification.requestPermission();
      if (res === "granted") {
        setAllowed(true);
      } else {
        setAllowed(false);
      }
    } catch (e) {
      console.error("[PermissionGate] permission request failed", e);
      setAllowed(false);
    }
  }, []);

  if (!allowed) {
    return <PermissionOverlay onContinue={handleContinue} />;
  }
  return children;
}
