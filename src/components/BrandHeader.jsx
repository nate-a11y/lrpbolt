import React, { useEffect } from "react";
import { AppBar, Toolbar, Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import LogoSwitcher from "./LogoSwitcher.jsx";

export default function BrandHeader() {
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  // Compute the dense toolbar height we use
  const headerHeight = upSm ? 64 : 56;

  // Expose the height globally so CssBaseline can pad content
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--appbar-h",
      `${headerHeight}px`,
    );
  }, [headerHeight]);

  return (
    <AppBar
      elevation={0}
      color="default"
      position="fixed"
      sx={{
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        zIndex: (t) => t.zIndex.drawer + 1,
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: headerHeight, gap: 1 }}>
        {/* left: menu + logo + title */}
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
        >
          <LogoSwitcher size={36} sx={{ mr: 0.5 }} />
          {/* ... existing left controls ... */}
          <Typography
            variant="h6"
            sx={{
              color: "text.primary",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontSize: {
                xs: "clamp(0.95rem, 0.86rem + 1vw, 1.1rem)",
                sm: "1.25rem",
              },
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: { xs: "60vw", sm: "none" },
            }}
          >
            LRP Driver Portal
          </Typography>
        </Box>

        {/* right controls */}
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
        >
          {/* ... existing right controls ... */}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
