import React, { useEffect } from "react";
import { AppBar, Toolbar, Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

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
        bgcolor: (t) => t.palette.background.paper,
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        zIndex: (t) => t.zIndex.drawer + 1,
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: headerHeight }}>
        {/* left: menu + logo + title */}
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
        >
          {/* ... existing left controls ... */}
          <Typography
            variant="h6"
            noWrap
            sx={{
              ml: 1,
              typography: { xs: "subtitle1", sm: "h6" },
              maxWidth: { xs: 160, sm: 260, md: 360 },
              fontWeight: 800,
              letterSpacing: "-0.01em",
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
