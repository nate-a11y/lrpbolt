/* Proprietary and confidential. See LICENSE. */
// allow-color-literal-file

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
      sx={{
        flexGrow: 1,
        minHeight: "calc(100vh - 160px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "rgba(255,255,255,0.8)",
        p: { xs: 2, sm: 3 },
        position: "relative",
      }}
    >
      {/* faint LRP halo */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: "50%",
          filter: "blur(48px)",
          background: "rgba(76,187,23,0.08)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          width: 90,
          height: 90,
          borderRadius: "50%",
          backgroundImage: (theme) =>
            (theme.palette.lrp && theme.palette.lrp.gradient) ||
            "linear-gradient(180deg, rgba(76,187,23,0.18) 0%, rgba(6,6,6,0) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2.5,
          boxShadow: "0 18px 40px rgba(76,187,23,0.18)",
        }}
      >
        <RefreshIcon
          sx={{ fontSize: 36, color: (t) => t.palette.primary.main }}
        />
      </Box>

      <Typography
        variant="h6"
        sx={{ mb: 0.75, color: "common.white", fontWeight: 800 }}
      >
        {message || "🚐 No rides ready to claim"}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.85, maxWidth: 360, mb: 2 }}>
        Tap refresh whenever you want to check for new rides. We’ll keep your
        place here.
      </Typography>

      {typeof onRefresh === "function" ? (
        <Stack spacing={1.5} alignItems="center">
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
            sx={{
              borderRadius: 9999,
              px: 3.25,
              py: 0.85,
              fontWeight: 700,
              color: "#060606",
              "&:hover": { filter: "brightness(1.08)" },
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh rides"}
          </Button>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
            Last updated: {lastUpdatedLabel}
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );
}
