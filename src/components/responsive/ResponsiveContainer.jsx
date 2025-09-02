import React from "react";
import { Box } from "@mui/material";

/**
 * Wraps page/content sections to enforce padding and max width with mobile-first rules.
 * Usage: <ResponsiveContainer><YourContent/></ResponsiveContainer>
 */
export default function ResponsiveContainer({ children, sx, maxWidth = 1280 }) {
  const resolvedMaxWidth =
    typeof maxWidth === "object"
      ? { xs: "100%", ...maxWidth }
      : { xs: "100%", lg: maxWidth };

  return (
    <Box
      sx={{
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 1.5, sm: 2, md: 3 },
        width: "100%",
        mx: "auto",
        ...sx,
        maxWidth: resolvedMaxWidth,
      }}
    >
      {children}
    </Box>
  );
}
