/* Proprietary and confidential. See LICENSE. */
import * as React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CircularProgress from "@mui/material/CircularProgress";

/**
 * EmptyRideState
 * Branded empty state with manual refresh affordance.
 *
 * Props:
 * - onRefresh (function): optional handler to trigger an immediate refresh.
 * - message (string): optional heading override.
 * - refreshing (boolean): disables the button while a refresh is in-flight.
 * - lastUpdatedLabel (string): human-friendly timestamp for the last sync.
 */
export default function EmptyRideState({
  onRefresh,
  message,
  refreshing = false,
  lastUpdatedLabel = "Never",
}) {
  return (
    <Box
      role="status"
      aria-live="polite"
      className="lrp-on-surface"
      sx={{
        flexGrow: 1,
        minHeight: "calc(100vh - 160px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        p: { xs: 2, sm: 3 },
      }}
    >
      <Box
        className="lrp-ring-glow"
        sx={{
          display: "grid",
          placeItems: "center",
          width: "min(100%, 520px)",
          borderRadius: 3,
          p: { xs: 3, sm: 4 },
          textAlign: "center",
          bgcolor: "transparent",
        }}
      >
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <Box
            sx={{
              mx: "auto",
              width: 96,
              height: 96,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              backgroundImage: (theme) => theme.palette.lrp.gradientRing,
            }}
          >
            <RefreshIcon fontSize="large" />
          </Box>

          <Typography
            variant="h6"
            sx={{ color: "text.primary", fontWeight: 800 }}
          >
            {message || "🚐 No rides ready to claim"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", maxWidth: 440, mx: "auto" }}
          >
            Tap refresh whenever you want to check for new rides. We’ll keep
            your place here.
          </Typography>

          {typeof onRefresh === "function" ? (
            <Stack spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={onRefresh}
                disabled={refreshing}
                startIcon={
                  refreshing ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )
                }
                sx={{ borderRadius: 9999, px: 3.25, py: 0.85, fontWeight: 700 }}
              >
                {refreshing ? "Refreshing…" : "Refresh rides"}
              </Button>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Last updated: {lastUpdatedLabel}
              </Typography>
            </Stack>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
