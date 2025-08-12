import React from "react";
import { Box } from "@mui/material";
export default function BrandGradient({ position = "top", height = 6, rounded = true, glow = false, animated = true }) {
  return (
    <Box
      aria-hidden
      sx={(t) => ({
        width: "100%",
        height,
        borderTopLeftRadius: position === "top" && rounded ? t.shape.borderRadius : 0,
        borderTopRightRadius: position === "top" && rounded ? t.shape.borderRadius : 0,
        borderBottomLeftRadius: position === "bottom" && rounded ? t.shape.borderRadius : 0,
        borderBottomRightRadius: position === "bottom" && rounded ? t.shape.borderRadius : 0,
        background: `linear-gradient(90deg, ${t.palette.brand.green700} 0%, ${t.palette.brand.green500} 40%, ${t.palette.brand.green400} 100%)`,
        filter: glow ? "drop-shadow(0 8px 18px rgba(76,187,23,0.35))" : "none",
        ...(animated && {
          backgroundSize: "200% 100%",
          animation: "lrpGradient 8s ease-in-out infinite",
          "@keyframes lrpGradient": { "0%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" }, "100%": { backgroundPosition: "0% 50%" } },
        }),
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      })}
    />
  );
}

