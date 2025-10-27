// src/components/LoadingScreen.jsx
/* Proprietary and confidential. See LICENSE. */
// allow-color-literal-file

import { Box, Typography, LinearProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, useReducedMotion } from "framer-motion";

import { imageSetFor } from "@/utils/assetVariant";

import useMediaQuery from "../hooks/useMediaQuery";

/**
 * Props:
 * - progress?: number | null   // 0..100 (if provided shows determinate bar), else indeterminate
 */
export default function LoadingScreen({ progress = null }) {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const upMd = useMediaQuery(theme.breakpoints.up("md"));

  // Simplified brand colors - static instead of theme-calculated
  const isDark = theme.palette.mode === "dark";
  const brand = {
    primary: isDark ? "#60A5FA" : "#2563EB",
    accent: isDark ? "#34D399" : "#059669",
  };

  // Simplified gradient - single linear gradient instead of multiple radials
  const gradient = isDark
    ? "linear-gradient(135deg, #0B0F19 0%, #0F1729 50%, #0B0F19 100%)"
    : "linear-gradient(135deg, #F6F8FC 0%, #EEF2F9 50%, #F6F8FC 100%)";

  const MotionBox = motion(Box);

  return (
    <Box
      role="status"
      aria-busy="true"
      sx={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: gradient,
        color: theme.palette.text.primary,
        zIndex: 1300, // above app shell
        overflow: "hidden",
      }}
    >
      {/* Faint watermark logo - simplified animation */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          width: upMd ? 220 : 160,
          height: upMd ? 220 : 160,
          opacity: theme.palette.mode === "dark" ? 0.04 : 0.06,
          backgroundImage: imageSetFor("/android-chrome-192x192.png"),
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          filter: "grayscale(100%)",
        }}
      />

      {/* Cardless center stack */}
      <MotionBox
        initial={prefersReducedMotion ? false : { y: 24, opacity: 0 }}
        animate={prefersReducedMotion ? {} : { y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        sx={{
          width: "min(92vw, 560px)",
          textAlign: "center",
          px: { xs: 2.5, sm: 3.5 },
        }}
      >
        {/* Brand wordmark inline to avoid layout shift */}
        <Box
          aria-hidden
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1.25,
            mb: 1.5,
          }}
        >
          <img
            src="/android-chrome-192x192.png"
            alt=""
            width={36}
            height={36}
            style={{ borderRadius: 8, boxShadow: "0 0 0 3px rgba(0,0,0,0.06)" }}
            onError={(e) => {
              // defensive: hide if asset missing
              try {
                e.currentTarget.style.display = "none";
              } catch (err) {
                // eslint-no-empty friendly
                console.error(err);
              }
            }}
          />
          <Typography
            variant={upMd ? "h4" : "h5"}
            fontWeight={800}
            sx={{
              letterSpacing: 0.2,
              background: `linear-gradient(90deg, ${brand.primary}, ${brand.accent})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            LRP Elite Portal
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ opacity: 0.8, mb: 2, mt: 0.5 }}>
          Buckle up — activating your driver dashboard.
        </Typography>

        {/* Progress */}
        <LinearProgress
          variant={
            typeof progress === "number" ? "determinate" : "indeterminate"
          }
          value={typeof progress === "number" ? progress : undefined}
          sx={{
            height: 8,
            borderRadius: 999,
            "& .MuiLinearProgress-bar": { borderRadius: 999 },
            "&.MuiLinearProgress-colorPrimary": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,.08)"
                  : "rgba(0,0,0,.06)",
            },
          }}
        />

        {/* Tiny tips - static for better performance */}
        <Box
          aria-live="polite"
          sx={{ mt: 1.5, minHeight: 24, color: theme.palette.text.secondary }}
        >
          <Typography variant="caption">
            Pro tip: press <b>Ctrl/⌘+K</b> to toggle dark mode anytime.
          </Typography>
        </Box>
      </MotionBox>
    </Box>
  );
}
