// src/components/LoadingScreen.jsx
/* Proprietary and confidential. See LICENSE. */
import { Box, Typography, LinearProgress, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, useReducedMotion } from "framer-motion";

import { imageSetFor } from "@/utils/assetVariant";

/**
 * Props:
 * - progress?: number | null   // 0..100 (if provided shows determinate bar), else indeterminate
 */
export default function LoadingScreen({ progress = null }) {
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const upMd = useMediaQuery(theme.breakpoints.up("md"));

  // Brand palette — tuned for light/dark
  const brand = {
    primary: theme.palette.mode === "dark" ? "#60A5FA" : "#2563EB", // LRP blue
    accent: theme.palette.mode === "dark" ? "#34D399" : "#059669", // emerald
    bg0: theme.palette.mode === "dark" ? "#0B0F19" : "#F6F8FC",
    bg1:
      theme.palette.mode === "dark"
        ? "rgba(96,165,250,.12)"
        : "rgba(37,99,235,.10)",
    bg2:
      theme.palette.mode === "dark"
        ? "rgba(52,211,153,.10)"
        : "rgba(5,150,105,.10)",
  };

  const gradient =
    theme.palette.mode === "dark"
      ? `radial-gradient(900px 600px at 20% -10%, ${brand.bg1}, transparent 60%),
         radial-gradient(900px 700px at 120% 120%, ${brand.bg2}, transparent 60%),
         linear-gradient(180deg, ${brand.bg0}, ${brand.bg0})`
      : `radial-gradient(900px 600px at 0% -20%, ${brand.bg1}, transparent 60%),
         radial-gradient(900px 700px at 120% 120%, ${brand.bg2}, transparent 60%),
         linear-gradient(180deg, ${brand.bg0}, ${brand.bg0})`;

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
      {/* Faint watermark logo */}
      <MotionBox
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
        animate={
          prefersReducedMotion
            ? {}
            : {
                y: [0, -8, 0],
                rotate: [0, 2, 0],
                transition: {
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }
        }
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

        {/* Tiny tips rotate */}
        <MotionBox
          aria-live="polite"
          sx={{ mt: 1.5, minHeight: 24, color: theme.palette.text.secondary }}
          key="tip-rotator"
          animate={prefersReducedMotion ? {} : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          <Typography variant="caption">
            Pro tip: press <b>Ctrl/⌘+K</b> to toggle dark mode anytime.
          </Typography>
        </MotionBox>
      </MotionBox>
    </Box>
  );
}
