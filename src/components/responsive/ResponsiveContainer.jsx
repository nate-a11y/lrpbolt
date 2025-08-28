import React from "react";
import { Box } from "@mui/material";

/**
 * Wraps page/content sections to enforce padding and max width with mobile-first rules.
 * Usage: <ResponsiveContainer><YourContent/></ResponsiveContainer>
 */
export default function ResponsiveContainer({ children, sx }) {
  return (
    <Box
      sx={{
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 1.5, sm: 2, md: 3 },
        width: "100%",
        maxWidth: { xs: "100%", lg: 1280 },
        mx: "auto",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
