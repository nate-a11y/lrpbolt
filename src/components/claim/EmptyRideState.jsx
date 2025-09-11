/* Proprietary and confidential. See LICENSE. */
import * as React from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Fade,
  IconButton,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

/**
 * EmptyRideState
 * Branded empty state with a circular countdown ring.
 *
 * Props:
 * - refreshIn (number): total seconds for the next auto-refresh. Defaults to 20.
 * - onRefresh (function): optional handler to trigger an immediate refresh.
 * - message (string): optional heading override.
 */
export default function EmptyRideState({ refreshIn = 20, onRefresh, message }) {
  const [count, setCount] = React.useState(refreshIn);

  React.useEffect(() => {
    setCount(refreshIn);
  }, [refreshIn]);

  React.useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const percent = React.useMemo(() => {
    if (refreshIn <= 0) return 0;
    return ((refreshIn - count) / refreshIn) * 100;
  }, [count, refreshIn]);

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
      <Fade in timeout={300}>
        <Box sx={{ position: "relative", display: "inline-flex", mb: 2 }}>
          <CircularProgress
            variant="determinate"
            value={percent}
            size={88}
            thickness={3}
            sx={{ color: "#4cbb17" }}
          />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: "absolute",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              color: "white",
            }}
          >
            {Math.max(count, 0)}s
          </Box>
        </Box>
      </Fade>

      <Typography variant="h6" sx={{ mb: 0.5, color: "white" }}>
        {message || "🚐 No rides available to claim"}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
        Refreshing automatically…
      </Typography>

      {typeof onRefresh === "function" && (
        <Tooltip title="Refresh now">
          <IconButton
            aria-label="Refresh now"
            onClick={onRefresh}
            sx={{
              mt: 0.5,
              color: "#4cbb17",
              "&:hover": {
                color: "white",
                backgroundColor: "rgba(76,187,23,0.12)",
              },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
